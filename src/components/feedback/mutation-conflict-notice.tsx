import { Alert, Button, Space } from "antd";

import {
  getMutationConflict,
  requiresConflictRefresh,
  type MutationConflictKind,
} from "~/api/errors/mutation-conflict";

export type MutationConflictResolution =
  "dismiss" | "keep-draft-and-reload" | "discard-draft-and-reload";

/**
 * A presentational boundary for mutation conflicts. It only reports the
 * caller's explicit decision; it never retries, reloads, or mutates draft
 * state by itself.
 */
export function MutationConflictNotice({
  error,
  onResolve,
}: Readonly<{
  error: unknown;
  onResolve(resolution: MutationConflictResolution, kind: MutationConflictKind): void;
}>) {
  const conflict = getMutationConflict(error);
  if (conflict === null) return null;

  if (!requiresConflictRefresh(conflict)) {
    return (
      <Alert
        action={
          <Button onClick={() => onResolve("dismiss", conflict.kind)} size="small" type="primary">
            知道了
          </Button>
        }
        description={conflict.detail}
        showIcon
        title={conflict.title}
        type="warning"
      />
    );
  }

  return (
    <Alert
      action={
        <Space orientation="vertical" size="small">
          <Button
            onClick={() => onResolve("keep-draft-and-reload", conflict.kind)}
            size="small"
            type="primary"
          >
            保留当前输入并刷新
          </Button>
          <Button onClick={() => onResolve("discard-draft-and-reload", conflict.kind)} size="small">
            放弃输入并刷新
          </Button>
        </Space>
      }
      description={conflict.detail}
      showIcon
      title={conflict.title}
      type="warning"
    />
  );
}
