import createClient from "openapi-fetch";

import type { components, paths } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";

export interface PublicMarketingFileDraft {
  draftId: number;
  expiresAt: string;
  uploadCapability: string;
}

async function readPayload(response: Response, fallback: unknown): Promise<unknown> {
  if (fallback !== undefined) return fallback;
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

function validFile(file: File): boolean {
  return (
    Number.isSafeInteger(file.size) &&
    file.size > 0 &&
    file.size <= Number.MAX_SAFE_INTEGER &&
    file.name.trim().length > 0
  );
}

export function createPublicMarketingApiClient() {
  const client = createClient<paths>({ baseUrl: "" });

  client.use({
    onRequest({ request }) {
      const headers = new Headers(request.headers);
      headers.delete("Authorization");
      return new Request(request, { credentials: "omit", headers });
    },
  });

  async function get<T>(
    request: Promise<{ data?: unknown; error?: unknown; response: Response }>,
  ): Promise<T> {
    const { data, error, response } = await request;
    if (response.ok) return data as T;
    throw ApiError.fromResponse(response, await readPayload(response, error));
  }

  return {
    getForm: (publicId: string) =>
      get<components["schemas"]["PublicMarketingFormResponse"]>(
        client.GET("/api/v1/open/marketing-forms/{publicId}", {
          params: { path: { publicId } },
        }),
      ),
    createFileDraft: async (publicId: string, fileFieldCodes: readonly string[]) => {
      const draft = await get<components["schemas"]["PublicMarketingFileDraftResponse"]>(
        client.POST("/api/v1/open/marketing-forms/{publicId}/file-drafts", {
          params: { path: { publicId } },
        }),
      );
      if (
        Date.parse(draft.expiresAt) <= Date.now() ||
        draft.uploadCapability.trim().length === 0 ||
        draft.fieldCodes.length !== fileFieldCodes.length ||
        !fileFieldCodes.every((fieldCode) => draft.fieldCodes.includes(fieldCode))
      ) {
        throw new Error("文件上传凭据暂时不可用，请重新选择文件。");
      }
      return {
        draftId: draft.draftId,
        expiresAt: draft.expiresAt,
        uploadCapability: draft.uploadCapability,
      } satisfies PublicMarketingFileDraft;
    },
    async uploadFiles(
      publicId: string,
      draft: PublicMarketingFileDraft,
      fieldCode: string,
      files: readonly File[],
    ) {
      if (
        Date.parse(draft.expiresAt) <= Date.now() ||
        files.length === 0 ||
        files.some((file) => !validFile(file))
      ) {
        throw new Error("请选择名称和大小均有效的文件后重新上传。");
      }
      const uploaded: components["schemas"]["PublicMarketingFileUploadStatusResponse"][] = [];
      for (const file of files) {
        const intent = await get<components["schemas"]["PublicMarketingUploadIntentResponse"]>(
          client.POST(
            "/api/v1/open/marketing-forms/{publicId}/file-drafts/{draftId}/fields/{fieldCode}/upload-intents",
            {
              body: {
                declaredMediaType: file.type.trim() || "application/octet-stream",
                displayName: file.name.trim(),
                expectedBytes: file.size,
              },
              params: {
                header: { "X-Public-Upload-Capability": draft.uploadCapability },
                path: { draftId: draft.draftId, fieldCode, publicId },
              },
            },
          ),
        );
        if (
          intent.draftId !== draft.draftId ||
          intent.fieldCode !== fieldCode ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          throw new Error("文件上传意图暂时不可用，请重新选择文件。");
        }
        let uploadResponse: Response;
        try {
          const headers = new Headers(intent.requiredHeaders);
          headers.set(intent.capabilityHeaderName, draft.uploadCapability);
          headers.delete("Authorization");
          uploadResponse = await fetch(intent.uploadUrl, {
            body: file,
            credentials: "omit",
            headers,
            method: intent.uploadMethod,
          });
        } catch {
          throw new Error("文件上传暂时失败，请检查网络后重试。");
        }
        if (!uploadResponse.ok) throw new Error("文件上传暂时失败，请重新选择文件。");
        const status = await get<components["schemas"]["PublicMarketingFileUploadStatusResponse"]>(
          client.GET(
            "/api/v1/open/marketing-forms/{publicId}/file-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
            {
              params: {
                header: { "X-Public-Upload-Capability": draft.uploadCapability },
                path: { draftId: draft.draftId, fieldCode, fileId: intent.fileId, publicId },
              },
            },
          ),
        );
        if (status.fileId !== intent.fileId || status.status !== "UPLOADED") {
          throw new Error("文件上传状态暂时不可用，请重新选择文件。");
        }
        uploaded.push(status);
      }
      return uploaded;
    },
    submit: (
      publicId: string,
      request: components["schemas"]["MarketingFormSubmissionRequest"],
      capability?: string,
    ) =>
      get<components["schemas"]["MarketingFormSubmissionResponse"]>(
        client.POST("/api/v1/open/marketing-forms/{publicId}", {
          body: request,
          params: {
            header: capability === undefined ? {} : { "X-Public-Upload-Capability": capability },
            path: { publicId },
          },
        }),
      ),
    withdrawFileDraft: (publicId: string, draft: PublicMarketingFileDraft) =>
      get<components["schemas"]["PublicMarketingFileDraftWithdrawalResponse"]>(
        client.DELETE("/api/v1/open/marketing-forms/{publicId}/file-drafts/{draftId}", {
          params: {
            header: { "X-Public-Upload-Capability": draft.uploadCapability },
            path: { draftId: draft.draftId, publicId },
          },
        }),
      ),
  };
}
