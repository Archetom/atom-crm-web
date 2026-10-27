import type { components } from "~/api/generated/schema";

export interface PageRequest {
  page: number;
  size: number;
}

export interface PageResult<T> extends PageRequest {
  items: T[];
  total: number | null;
  meta: Record<string, unknown>;
}

/** The CRM reference lists present 15 records per page before a user changes the pager. */
export const defaultPageRequest: PageRequest = { page: 1, size: 15 };
export const maxPageSize = 200;

type PageEnvelope<T> = Pick<
  components["schemas"]["Pager"],
  "pageNum" | "pageSize" | "totalNum" | "meta"
> & {
  objectList?: readonly T[];
};

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 1
    ? Math.min(parsed, maximum)
    : fallback;
}

export function normalizePageRequest(input: Partial<PageRequest>): PageRequest {
  return {
    page: boundedInteger(input.page, defaultPageRequest.page, 1_000_000),
    size: boundedInteger(input.size, defaultPageRequest.size, maxPageSize),
  };
}

export function toPageResult<TSource, T>(
  pager: PageEnvelope<TSource>,
  decode: (value: TSource) => T | null,
): PageResult<T> {
  const request = normalizePageRequest({
    page: pager.pageNum ?? defaultPageRequest.page,
    size: pager.pageSize ?? defaultPageRequest.size,
  });
  const total = typeof pager.totalNum === "number" && pager.totalNum >= 0 ? pager.totalNum : null;
  const items = (pager.objectList ?? []).flatMap((value) => {
    const item = decode(value);
    return item === null ? [] : [item];
  });

  return { ...request, items, total, meta: pager.meta ?? {} };
}
