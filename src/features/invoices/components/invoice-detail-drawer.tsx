import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { CustomerInvoiceDetailSurface } from "../pages/customer-invoice-detail-page";

import styles from "./invoice-detail-drawer.module.css";

export function InvoiceDetailDrawer({
  invoiceId,
  open,
  onClose,
}: Readonly<{
  invoiceId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, invoiceId);

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
      title="发票详情"
      onClose={handleClose}
    >
      <CustomerInvoiceDetailSurface customerId={null} invoiceId={invoiceId} onClose={handleClose} />
    </Drawer>
  );
}
