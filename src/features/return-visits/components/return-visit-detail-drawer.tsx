import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { CustomerReturnVisitDetailSurface } from "../pages/customer-return-visit-detail-page";

import styles from "./return-visit-detail-drawer.module.css";

export function ReturnVisitDetailDrawer({
  returnVisitId,
  open,
  onClose,
  onEdit,
}: Readonly<{
  returnVisitId: number | null;
  open: boolean;
  onClose(): void;
  onEdit(customerId: number, returnVisitId: number): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, returnVisitId);

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
      title="回访详情"
      onClose={handleClose}
    >
      <CustomerReturnVisitDetailSurface
        customerId={null}
        returnVisitId={returnVisitId}
        onClose={handleClose}
        onEdit={onEdit}
      />
    </Drawer>
  );
}
