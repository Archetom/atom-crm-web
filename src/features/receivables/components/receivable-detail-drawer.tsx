import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { CustomerReceivableDetailSurface } from "../pages/customer-receivable-detail-page";

import styles from "./receivable-detail-drawer.module.css";

export function ReceivableDetailDrawer({
  receivableId,
  open,
  onClose,
}: Readonly<{
  receivableId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, receivableId);

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
      title="回款详情"
      onClose={handleClose}
    >
      <CustomerReceivableDetailSurface
        customerId={null}
        receivableId={receivableId}
        onClose={handleClose}
      />
    </Drawer>
  );
}
