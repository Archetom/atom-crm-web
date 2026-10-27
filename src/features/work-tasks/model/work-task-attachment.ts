import { recordOf } from "~/shared/utils/decode";

export interface WorkTaskAttachment {
  fileId: number;
  displayName: string;
  mediaType: string | null;
  version: number;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Discards size, uploader, timestamps, availability state, and every undeclared field. */
export function toWorkTaskAttachment(value: unknown): WorkTaskAttachment | null {
  const source = recordOf(value);
  if (source === null) return null;

  const fileId = positiveIdentifier(source.fileId);
  const displayName = optionalText(source.displayName);
  const version = source.version;
  if (
    fileId === null ||
    displayName === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return { displayName, fileId, mediaType: optionalText(source.mediaType), version };
}
