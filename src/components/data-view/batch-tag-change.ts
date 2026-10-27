const tagSeparator = /[,\n\r]/u;

export interface BatchTagChange {
  addedTags: string[];
  removedTags: string[];
}

function tagsFromInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(tagSeparator)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  );
}

export function parseBatchTagChange(
  addedInput: string,
  removedInput: string,
): BatchTagChange | null {
  const addedTags = tagsFromInput(addedInput);
  const removedTags = tagsFromInput(removedInput);

  return addedTags.length > 0 || removedTags.length > 0 ? { addedTags, removedTags } : null;
}

export function batchTagValidationError(change: BatchTagChange | null): string | null {
  if (change === null) return "请至少填写一个要添加或移除的标签。";

  const tags = [...change.addedTags, ...change.removedTags];
  if (tags.length > 100 || change.addedTags.length > 50 || change.removedTags.length > 50) {
    return "每种操作最多可填写 50 个标签。";
  }
  if (tags.some((tag) => tag.length > 50)) return "每个标签最多 50 个字符。";

  const removed = new Set(change.removedTags);
  if (change.addedTags.some((tag) => removed.has(tag))) {
    return "同一标签不能同时添加和移除。";
  }
  return null;
}
