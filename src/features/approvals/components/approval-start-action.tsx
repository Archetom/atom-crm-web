import { Button } from "antd";
import { useState } from "react";

import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";

import { ApprovalStartModal } from "./approval-start-modal";

interface ApprovalStartActionProps {
  objectType: string;
  subjectId: number;
  onStarted?: () => void;
}

/**
 * Opens the server-governed approval flow only from a currently rendered business
 * record. Object type is a feature-owned constant and the server rechecks both it
 * and the subject's current visibility before returning any start option.
 */
export function ApprovalStartAction({
  objectType,
  subjectId,
  onStarted,
}: Readonly<ApprovalStartActionProps>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionAuthority authority={authority.approvalsSubmit}>
        <Button onClick={() => setOpen(true)}>发起审批</Button>
      </ActionAuthority>
      <ApprovalStartModal
        objectType={objectType}
        open={open}
        subjectId={subjectId}
        onClose={() => setOpen(false)}
        onStarted={onStarted}
      />
    </>
  );
}
