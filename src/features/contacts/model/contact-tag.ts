const maxContactTagCount = 50;
const maxContactTagLength = 50;

function tagKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

/** Normalizes an explicit contact-tag draft without inventing or merging values. */
export function normalizeContactTagDraft(values: readonly string[]): string[] | null {
  if (values.length > maxContactTagCount) return null;

  const known = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const tag = value.trim();
    if (tag.length === 0 || tag.length > maxContactTagLength || known.has(tagKey(tag))) {
      return null;
    }
    known.add(tagKey(tag));
    normalized.push(tag);
  }
  return normalized;
}

/** Decodes only a valid, unmasked server-visible contact-tag catalog. */
export function decodeContactTagCatalog(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new Error("联系人标签目录数据暂时不可用，请稍后重试。");
  }

  const tags = normalizeContactTagDraft(value);
  if (tags === null) throw new Error("联系人标签目录数据暂时不可用，请稍后重试。");
  return tags;
}
