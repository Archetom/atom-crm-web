import type { components } from "~/api/generated/schema";

export interface ProductAttachment {
  actualBytes: number | null;
  displayName: string;
  fileId: number;
  mediaType: string | null;
  version: number | null;
}

function positiveSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonnegativeSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function toProductAttachment(
  value: components["schemas"]["AttachmentResponse"],
): ProductAttachment | null {
  const fileId = positiveSafeInteger(value.fileId);
  if (fileId === null) return null;

  return {
    actualBytes: nonnegativeSafeInteger(value.actualBytes),
    displayName: optionalText(value.displayName) ?? `附件 #${fileId}`,
    fileId,
    mediaType: optionalText(value.mediaType),
    version: nonnegativeSafeInteger(value.version),
  };
}

export function toProductAttachments(
  source: readonly components["schemas"]["AttachmentResponse"][],
): ProductAttachment[] {
  return source.flatMap((attachment) => {
    const decoded = toProductAttachment(attachment);
    return decoded === null ? [] : [decoded];
  });
}

export function formatProductAttachmentSize(value: number | null): string {
  if (value === null) return "大小未提供";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
