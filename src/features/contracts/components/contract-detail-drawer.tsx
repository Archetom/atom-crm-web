import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { CustomerContractDetailSurface } from "../pages/customer-contract-detail-page";

import styles from "./contract-detail-drawer.module.css";

export function ContractDetailDrawer({
  contractId,
  customerId,
  open,
  onClose,
}: Readonly<{
  contractId: number | null;
  customerId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, contractId);

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
      title="合同详情"
      onClose={handleClose}
    >
      <CustomerContractDetailSurface
        contractId={contractId}
        customerId={customerId}
        onClose={handleClose}
      />
    </Drawer>
  );
}
