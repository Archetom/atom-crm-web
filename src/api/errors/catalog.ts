/**
 * Stable error codes are the only server failure messages rendered directly to users.
 * Keep this list additive and map new codes during the OpenAPI/backend contract review.
 */
export const errorMessageCatalog = {
  VERSION_CONFLICT: "该记录已被其他成员修改，请刷新后再试。",
  CONCURRENT_OPERATION: "该操作正在被并发处理，请刷新后重试。",
  RESOURCE_ALREADY_EXISTS: "相同资源已存在，请检查后再提交。",
  OPERATION_NOT_ALLOWED: "当前状态不允许执行该操作。",
  APPROVAL_ACTION_NOT_ALLOWED: "当前审批状态不允许执行该操作。",
  APPROVAL_ALREADY_PROCESSED: "该审批已处理，请刷新后再试。",
  TRANSFER_TARGET_INVALID: "所选转审成员当前不可用，请重新选择。",
  BATCH_ABORTED: "批量审批未执行，未修改任何事项。",
  FORBIDDEN: "你没有执行此操作的权限。",
  RESOURCE_NOT_FOUND: "记录不存在，或你已无权查看。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后重试。",
  VALIDATION_FAILED: "请检查输入内容后再提交。",
} as const;

export type KnownErrorCode = keyof typeof errorMessageCatalog;

export function getErrorMessage(errorCode?: string): string {
  if (errorCode && errorCode in errorMessageCatalog) {
    return errorMessageCatalog[errorCode as KnownErrorCode];
  }

  // Backend error codes include a stable operation prefix. Only inspect the documented
  // error-specific suffix; never render the server-provided error message.
  if (errorCode?.endsWith("102")) return "登录信息无效或已过期，请重新登录。";
  if (errorCode?.endsWith("311")) return "暂时无法发送找回密码邮件，请稍后再试。";

  return "操作未完成，请稍后重试。";
}
