import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { OpportunityDetailSurface } from "../pages/opportunity-detail-page";

import styles from "./opportunity-detail-drawer.module.css";

export function OpportunityDetailDrawer({
  opportunityId,
  open,
  onClose,
}: Readonly<{
  opportunityId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, opportunityId);

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
      title="商机详情"
      onClose={handleClose}
    >
      <OpportunityDetailSurface opportunityId={opportunityId} onClose={handleClose} />
    </Drawer>
  );
}
