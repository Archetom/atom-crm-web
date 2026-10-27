export interface ControlledDownload {
  blob: Blob;
  contentType: string | null;
  fileName: string;
}

const fallbackFileName = "download";

function sanitizeFileName(value: string): string {
  const withoutControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  const sanitized = withoutControls.replace(/[\\/]/g, "-").replace(/^\.+/, "").trim().slice(0, 180);

  return sanitized.length > 0 ? sanitized : fallbackFileName;
}

function decodeExtendedFilename(value: string): string | null {
  const match = value.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function plainFilename(value: string): string | null {
  const match = value.match(/filename\s*=\s*(?:"([^"]*)"|([^;\s]*))/i);
  return match?.[1] ?? match?.[2] ?? null;
}

export function getDownloadFileName(contentDisposition: string | null): string {
  if (contentDisposition === null) return fallbackFileName;

  const fileName = decodeExtendedFilename(contentDisposition) ?? plainFilename(contentDisposition);
  return fileName === null ? fallbackFileName : sanitizeFileName(fileName);
}

export function createControlledDownload(response: Response, blob: Blob): ControlledDownload {
  const contentType = response.headers.get("content-type");
  return {
    blob,
    contentType,
    fileName: getDownloadFileName(response.headers.get("content-disposition")),
  };
}

/**
 * Starts a browser download from a short-lived Blob URL. This is deliberately
 * not a protected-resource URL: authentication has already completed through
 * the API client before this function is called.
 */
export function saveControlledDownload(download: ControlledDownload): void {
  const objectUrl = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");
  anchor.download = download.fileName;
  anchor.href = objectUrl;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
