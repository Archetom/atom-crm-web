import { getErrorMessage } from "./catalog";

export interface ErrorPayload {
  errCode?: unknown;
  errMsg?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(getErrorMessage(code));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  static fromResponse(response: Response, payload?: unknown): ApiError {
    const code = getErrorCode(payload);
    return new ApiError(response.status, code);
  }
}

export function getErrorCode(payload?: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const value = (payload as ErrorPayload).errCode;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
