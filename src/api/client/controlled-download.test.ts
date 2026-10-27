import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createControlledDownload,
  getDownloadFileName,
  saveControlledDownload,
} from "./controlled-download";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getDownloadFileName", () => {
  it("prefers a UTF-8 filename and sanitizes unsafe path characters", () => {
    expect(
      getDownloadFileName(
        "attachment; filename=ignored.txt; filename*=UTF-8''%E5%AE%A2%E6%88%B7%2F%E8%B5%84%E6%96%99.txt",
      ),
    ).toBe("客户-资料.txt");
  });

  it("uses a stable fallback for invalid or missing filenames", () => {
    expect(getDownloadFileName(null)).toBe("download");
    expect(getDownloadFileName("attachment; filename*=UTF-8''%ZZ")).toBe("download");
    expect(getDownloadFileName('attachment; filename="../"')).toBe("-");
  });
});

describe("controlled Blob download", () => {
  it("only creates a transient Blob URL after a controlled response", () => {
    const response = new Response(new Blob(["content"], { type: "text/plain" }), {
      headers: {
        "Content-Disposition": 'attachment; filename="note.txt"',
        "Content-Type": "text/plain",
      },
    });
    const download = createControlledDownload(
      response,
      new Blob(["content"], { type: "text/plain" }),
    );
    const createObjectURL = vi.fn(() => "blob:controlled-file");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    saveControlledDownload(download);

    expect(download).toMatchObject({ contentType: "text/plain", fileName: "note.txt" });
    expect(createObjectURL).toHaveBeenCalledWith(download.blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[href="blob:controlled-file"]')).toBeNull();
  });

  it("revokes the transient Blob URL so the controlled bytes stay short lived", () => {
    vi.useFakeTimers();
    try {
      const createObjectURL = vi.fn(() => "blob:controlled-file");
      const revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

      saveControlledDownload({
        blob: new Blob(["content"], { type: "text/plain" }),
        contentType: "text/plain",
        fileName: "note.txt",
      });

      // The revoke is deferred so the browser can start the download first.
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:controlled-file");
    } finally {
      vi.useRealTimers();
    }
  });
});
