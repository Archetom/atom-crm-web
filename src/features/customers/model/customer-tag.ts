const maxCustomerTagCount = 50;
const maxCustomerTagLength = 50;

function tagKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

/**
 * Normalizes an explicit tag draft without inventing, masking, or merging
 * values. Duplicate names are rejected locally so the full-replacement
 * operation has one unambiguous user-confirmed baseline.
 */
export function normalizeCustomerTagDraft(values: readonly string[]): readonly string[] | null {
  if (values.length > maxCustomerTagCount) return null;

  const known = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const tag = value.trim();
    if (tag.length === 0 || tag.length > maxCustomerTagLength || known.has(tagKey(tag))) {
      return null;
    }
    known.add(tagKey(tag));
    normalized.push(tag);
  }
  return normalized;
}

/**
 * This catalog endpoint is also the server's proof that the caller may read
 * unmasked customer tags. Reject malformed or ambiguous data before it can
 * become a full-replacement baseline.
 */
export function decodeCustomerTagCatalog(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new Error("客户标签目录数据暂时不可用，请稍后重试。");
  }

  const tags = normalizeCustomerTagDraft(value);
  if (tags === null) throw new Error("客户标签目录数据暂时不可用，请稍后重试。");
  return tags;
}
