import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { LeadDetailSurface } from "../pages/lead-detail-page";

import styles from "./lead-detail-drawer.module.css";

export function LeadDetailDrawer({
  leadId,
  open,
  onClose,
}: Readonly<{
  leadId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, leadId);

  function handleClose() {
    requestFocusRestore();
    onClose();
    scheduleFocusRestore();
  }

  return (
    <Drawer
      afterOpenChange={restoreFocusAfterClose}
      className={styles.drawer}
      destroyOnHidden
      focusable={{ focusTriggerAfterClose: false }}
      open={open}
      placement="right"
      rootClassName={styles.root}
      size="min(960px, calc(100vw - 280px))"
      title="线索详情"
      onClose={handleClose}
    >
      <LeadDetailSurface leadId={leadId} onClose={handleClose} />
    </Drawer>
  );
}
