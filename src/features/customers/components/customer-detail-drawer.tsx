import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { CustomerDetailSurface } from "../pages/customer-detail-page";

import styles from "./customer-detail-drawer.module.css";

export function CustomerDetailDrawer({
  customerId,
  open,
  onClose,
}: Readonly<{
  customerId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, customerId);

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
      title="客户详情"
      onClose={handleClose}
    >
      <CustomerDetailSurface customerId={customerId} onClose={handleClose} />
    </Drawer>
  );
}
