import type { components } from "~/api/generated/schema";

export const MAX_PERFORMANCE_TARGET_IMPORT_FILE_BYTES = 1024 * 1024;
export const MAX_PERFORMANCE_TARGET_IMPORT_ROWS = 200;

export type PerformanceTargetImportScope = "MEMBER" | "DEPARTMENT";

export type PerformanceTargetImportCommand =
  | {
      request: components["schemas"]["PerformanceTargetImportRequest"];
      scope: "MEMBER";
    }
  | {
      request: components["schemas"]["DepartmentPerformanceTargetImportRequest"];
      scope: "DEPARTMENT";
    };

class PerformanceTargetImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerformanceTargetImportParseError";
  }
}

export function isPerformanceTargetImportParseError(error: unknown): error is Error {
  return error instanceof PerformanceTargetImportParseError;
}

const memberHeaders = ["memberId", "targetYear", "targetMonth", "amount"] as const;
const departmentHeaders = [
  "departmentId",
  "targetYear",
  "period",
  "periodNumber",
  "amount",
] as const;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const positiveIntegerPattern = /^[1-9]\d*$/;

export function performanceTargetImportTemplate(scope: PerformanceTargetImportScope): string {
  return scope === "MEMBER"
    ? `${memberHeaders.join(",")}\n1001,2026,1,100000.00\n`
    : `${departmentHeaders.join(",")}\n10,2026,YEAR,1,1200000.00\n`;
}

/**
 * Decodes a user-selected CSV entirely in browser memory. The returned command contains only
 * server-contract values, never the source filename or source bytes.
 */
export function parsePerformanceTargetImportCsv(
  scope: PerformanceTargetImportScope,
  source: string,
): PerformanceTargetImportCommand {
  if (source.length === 0) throw invalid("CSV 文件为空");
  if (source.length > MAX_PERFORMANCE_TARGET_IMPORT_FILE_BYTES) {
    throw invalid("CSV 文件不能超过 1 MB");
  }
  const rows = parseCsvRows(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (rows.length < 2) throw invalid("CSV 需要包含表头和至少一条目标数据");
  const [header, ...dataRows] = rows;
  if (dataRows.length > MAX_PERFORMANCE_TARGET_IMPORT_ROWS) {
    throw invalid(`一次最多导入 ${MAX_PERFORMANCE_TARGET_IMPORT_ROWS} 条目标数据`);
  }

  if (scope === "MEMBER") {
    expectHeaders(header, memberHeaders);
    const targets = dataRows.map((row, index) => parseMemberRow(row, index + 2));
    expectUniqueRows(
      targets,
      (target) => `${target.memberId}:${target.targetYear}:${target.targetMonth}`,
    );
    return { request: { metric: "ACTIVE_CONTRACT", targets }, scope };
  }

  expectHeaders(header, departmentHeaders);
  const targets = dataRows.map((row, index) => parseDepartmentRow(row, index + 2));
  expectUniqueRows(
    targets,
    (target) =>
      `${target.departmentId}:${target.targetYear}:${target.period}:${target.periodNumber}`,
  );
  return { request: { metric: "ACTIVE_CONTRACT", targets }, scope };
}

function parseMemberRow(
  row: string[],
  line: number,
): components["schemas"]["PerformanceTargetImportItemRequest"] {
  expectWidth(row, memberHeaders.length, line);
  const [memberId, targetYear, targetMonth, amount] = row;
  return {
    amount: parseAmount(amount, line),
    memberId: parsePositiveInteger(memberId, "成员 ID", line),
    targetMonth: parseBoundedInteger(targetMonth, "目标月份", 1, 12, line),
    targetYear: parseBoundedInteger(targetYear, "目标年度", 2000, 9999, line),
  };
}

function parseDepartmentRow(
  row: string[],
  line: number,
): components["schemas"]["DepartmentPerformanceTargetImportItemRequest"] {
  expectWidth(row, departmentHeaders.length, line);
  const [departmentId, targetYear, rawPeriod, periodNumber, amount] = row;
  const period = rawPeriod.trim();
  if (period !== "YEAR" && period !== "QUARTER" && period !== "MONTH") {
    throw invalid(`第 ${line} 行目标周期必须是 YEAR、QUARTER 或 MONTH`);
  }
  const parsedPeriodNumber = parsePositiveInteger(periodNumber, "周期序号", line);
  const maximum = period === "YEAR" ? 1 : period === "QUARTER" ? 4 : 12;
  if (parsedPeriodNumber > maximum) {
    throw invalid(`第 ${line} 行${period} 的周期序号无效`);
  }
  return {
    amount: parseAmount(amount, line),
    departmentId: parsePositiveInteger(departmentId, "部门 ID", line),
    period,
    periodNumber: parsedPeriodNumber,
    targetYear: parseBoundedInteger(targetYear, "目标年度", 2000, 9999, line),
  };
}

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let atFieldStart = true;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\u0000") throw invalid("CSV 不能包含空字符");
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      if (!atFieldStart) throw invalid("CSV 引号必须位于字段开头");
      quoted = true;
      atFieldStart = false;
    } else if (character === ",") {
      row.push(value);
      value = "";
      atFieldStart = true;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      atFieldStart = true;
    } else {
      value += character;
      atFieldStart = false;
    }
  }
  if (quoted) throw invalid("CSV 存在未闭合的引号");
  row.push(value);
  rows.push(row);
  return rows;
}

function expectHeaders(row: string[], expected: readonly string[]): void {
  const normalized = row.map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, "").trim() : value.trim(),
  );
  if (
    normalized.length !== expected.length ||
    !normalized.every((value, index) => value === expected[index])
  ) {
    throw invalid(`CSV 表头必须为：${expected.join(",")}`);
  }
}

function expectWidth(row: string[], width: number, line: number): void {
  if (row.length !== width) throw invalid(`第 ${line} 行列数不正确`);
}

function expectUniqueRows<T>(targets: readonly T[], key: (target: T) => string): void {
  const keys = targets.map(key);
  if (new Set(keys).size !== keys.length) throw invalid("CSV 不可包含重复的目标主体和周期");
}

function parsePositiveInteger(value: string, label: string, line: number): number {
  const normalized = value.trim();
  if (!positiveIntegerPattern.test(normalized)) throw invalid(`第 ${line} 行${label}必须是正整数`);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) throw invalid(`第 ${line} 行${label}超出可安全传输范围`);
  return parsed;
}

function parseBoundedInteger(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
  line: number,
): number {
  const parsed = parsePositiveInteger(value, label, line);
  if (parsed < minimum || parsed > maximum) {
    throw invalid(`第 ${line} 行${label}必须在 ${minimum} 到 ${maximum} 之间`);
  }
  return parsed;
}

function parseAmount(value: string, line: number): number {
  const normalized = value.trim();
  if (!decimalPattern.test(normalized)) {
    throw invalid(`第 ${line} 行目标金额必须是最多两位小数的正数`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
    throw invalid(`第 ${line} 行目标金额超出可安全传输范围`);
  }
  return parsed;
}

function invalid(message: string): PerformanceTargetImportParseError {
  return new PerformanceTargetImportParseError(message);
}
