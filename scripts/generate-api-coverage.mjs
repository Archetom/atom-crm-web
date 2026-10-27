import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const snapshotPath = resolve("openapi/atom-crm.json");
const overridePath = resolve("openapi/coverage-overrides.json");
const outputPath = resolve("docs/api-coverage.md");
const methods = ["get", "post", "put", "patch", "delete"];

const document = JSON.parse(await readFile(snapshotPath, "utf8"));
const overrides = JSON.parse(await readFile(overridePath, "utf8"));

if (!document.paths || typeof document.paths !== "object") {
  throw new Error("The OpenAPI snapshot does not contain a paths object.");
}

function classify(pathname) {
  if (pathname.startsWith("/api/v1/open/marketing-forms")) return "公开页面";

  if (
    pathname.startsWith("/api/v1/open/leads") ||
    pathname.startsWith("/api/v1/connector-ingress")
  ) {
    return "API-only";
  }

  return "内部 UI";
}

const phaseRules = [
  ["/api/v1/marketing-activities", "P8"],
  ["/api/v1/open/marketing-forms", "P6"],
  ["/api/v1/marketing-forms", "P6"],
  ["/api/v1/oa/", "P6"],
  ["/api/v1/reports", "P6"],
  ["/api/v1/dashboard/preferences", "P6"],
  ["/api/v1/work/", "P5"],
  ["/api/v1/approvals", "P5"],
  ["/api/v1/approval-definitions", "P5"],
  ["/api/v1/stage-workflows", "P5"],
  ["/api/v1/stage-workflow-records", "P5"],
  ["/api/v1/notifications", "P5"],
  ["/api/v1/worklist", "P5"],
  ["/api/v1/contracts", "P4"],
  ["/api/v1/invoices", "P4"],
  ["/api/v1/invoice-profiles", "P4"],
  ["/api/v1/receivables", "P4"],
  ["/api/v1/receivable-plans", "P4"],
  ["/api/v1/customers", "P3"],
  ["/api/v1/customer-pools", "P3"],
  ["/api/v1/contacts", "P3"],
  ["/api/v1/contact-pools", "P3"],
  ["/api/v1/leads", "P3"],
  ["/api/v1/opportunities", "P3"],
  ["/api/v1/opportunity-pipelines", "P3"],
  ["/api/v1/products", "P3"],
  ["/api/v1/product-categories", "P3"],
  ["/api/v1/activities", "P3"],
  ["/api/v1/return-visits", "P3"],
  ["/api/v1/attachment-targets", "P2"],
  ["/api/v1/file-field-drafts", "P2"],
  ["/api/v1/crm-import-drafts", "P3"],
  ["/api/v1/reference/regions", "P2"],
  ["/api/v1/dashboard/overview", "P1"],
  ["/api/v1/navigation", "P1"],
  ["/api/v1/authorization/me", "P1"],
  ["/api/v1/authorization/capabilities", "P1"],
];

const authorityRules = [
  ["/api/v1/marketing-activities", "marketing-activities:*"],
  ["/api/v1/open/marketing-forms", "匿名公开通道"],
  ["/api/v1/open/leads", "接入客户端 API Key"],
  ["/api/v1/connector-ingress", "连接器凭证"],
  ["/api/v1/customers", "customers:*"],
  ["/api/v1/customer-pools", "customer-pools:*"],
  ["/api/v1/contacts", "contacts:*"],
  ["/api/v1/contact-pools", "contact-pools:*"],
  ["/api/v1/leads", "leads:*"],
  ["/api/v1/lead-intake-clients", "leads:intake-manage"],
  ["/api/v1/opportunities", "opportunities:*"],
  ["/api/v1/opportunity-pipelines", "opportunity-pipelines:*"],
  ["/api/v1/products", "products:*"],
  ["/api/v1/product-categories", "products:*"],
  ["/api/v1/contracts", "contracts:*"],
  ["/api/v1/invoices", "invoices:*"],
  ["/api/v1/invoice-profiles", "invoices:*"],
  ["/api/v1/receivables", "receivables:*"],
  ["/api/v1/receivable-plans", "receivable-plans:*"],
  ["/api/v1/activities", "activities:*"],
  ["/api/v1/return-visits", "return-visits:*"],
  ["/api/v1/worklist", "worklist:read"],
  ["/api/v1/work/", "work-tasks:*"],
  ["/api/v1/notifications", "notifications:read"],
  ["/api/v1/approvals", "approvals:*"],
  ["/api/v1/approval-definitions", "approvals:*"],
  ["/api/v1/stage-workflows", "workflows:*"],
  ["/api/v1/stage-workflow-records", "workflows:*"],
  ["/api/v1/oa/forms", "oa-forms:*"],
  ["/api/v1/oa/requests", "oa-requests:*"],
  ["/api/v1/oa/announcements", "oa-announcements:*"],
  ["/api/v1/marketing-forms", "marketing-forms:*"],
  ["/api/v1/reports", "reports:*"],
  ["/api/v1/dashboard/department-performance-targets", "dashboard-targets:read/write"],
  ["/api/v1/dashboard/performance-targets", "dashboard-targets:*"],
  ["/api/v1/dashboard", "后端路由 guard"],
  ["/api/v1/organization", "organization:* / users:*"],
  ["/api/v1/authorization", "authorization:*"],
  ["/api/v1/navigation", "navigation:*"],
  ["/api/v1/fields", "fields:*"],
  ["/api/v1/saved-views", "saved-views:*"],
  ["/api/v1/embedded-pages", "embedded-pages:*"],
  ["/api/v1/enterprise-data", "enterprise-data:read"],
  ["/api/v1/connectors", "connectors:*"],
  ["/api/v1/attachment-targets", "files:* + 业务对象权限"],
  ["/api/v1/file-field-drafts", "files:* + 字段策略"],
  ["/api/v1/crm-import-drafts", "leads:write 或 contacts:write + files:write"],
  ["/api/v1/reference/regions", "后端路由 guard"],
];

function firstRuleValue(pathname, rules, fallback) {
  return rules.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? fallback;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const rows = [];
for (const [pathname, pathItem] of Object.entries(document.paths)) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;

    const key = `${method.toUpperCase()} ${pathname}`;
    const override = overrides[key] ?? {};
    rows.push({
      key,
      classification: override.classification ?? classify(pathname),
      surface: override.surface ?? operation.summary ?? operation.operationId ?? "待定义动作",
      phase: override.phase ?? firstRuleValue(pathname, phaseRules, "P7"),
      authority:
        override.authority ?? firstRuleValue(pathname, authorityRules, "后端路由 guard（待核对）"),
    });
  }
}

rows.sort((left, right) => left.key.localeCompare(right.key));

const content = [
  "# API 覆盖矩阵",
  "",
  `> 由 \`pnpm api:coverage\` 根据 \`openapi/atom-crm.json\` 生成。快照版本：${document.info?.version ?? "unknown"}；接口数：${rows.length}。`,
  "> 不要直接编辑表格；需要覆盖默认分类、动作、阶段或 authority 的接口，写入 `openapi/coverage-overrides.json` 后重新生成。Authority 仅表示前端守卫候选，最终访问控制始终以服务端为准。",
  "",
  "| 接口 | 分类 | 页面/动作 | 阶段 | Authority |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${escapeCell(row.key)} | ${escapeCell(row.classification)} | ${escapeCell(row.surface)} | ${escapeCell(row.phase)} | ${escapeCell(row.authority)} |`,
  ),
  "",
].join("\n");

await writeFile(outputPath, content, "utf8");
console.log(`Wrote ${rows.length} API coverage rows to ${outputPath}.`);
