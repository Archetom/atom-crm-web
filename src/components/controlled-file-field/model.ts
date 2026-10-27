import { recordOf } from "~/shared/utils/decode";

export interface ControlledFileFieldAttachment {
  actualBytes: number | null;
  displayName: string;
  fileId: number;
  mediaType: string | null;
}

export interface ControlledFileField {
  attachments: readonly ControlledFileFieldAttachment[];
  fieldCode: string;
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

function decodeAttachment(value: unknown): ControlledFileFieldAttachment | null {
  const source = recordOf(value);
  if (source === null) return null;

  const fileId = positiveSafeInteger(source.fileId);
  if (fileId === null) return null;

  return {
    actualBytes: nonnegativeSafeInteger(source.actualBytes),
    displayName: optionalText(source.displayName) ?? `附件 #${fileId}`,
    fileId,
    mediaType: optionalText(source.mediaType),
  };
}

/**
 * Decodes only server-authorized CRM FILE field paths. Field code validation
 * mirrors the backend value object; callers still must supply a server-issued
 * target ID to the controlled download API.
 */
export function decodeControlledFileFields(value: unknown): ControlledFileField[] {
  const source = recordOf(value);
  if (source === null) return [];

  return Object.entries(source).flatMap(([fieldCode, attachments]) => {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(fieldCode) || !Array.isArray(attachments)) return [];

    const decodedAttachments = attachments.flatMap((attachment) => {
      const decoded = decodeAttachment(attachment);
      return decoded === null ? [] : [decoded];
    });
    return decodedAttachments.length > 0 ? [{ attachments: decodedAttachments, fieldCode }] : [];
  });
}

export function formatControlledFileFieldSize(value: number | null): string {
  if (value === null) return "大小未提供";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
