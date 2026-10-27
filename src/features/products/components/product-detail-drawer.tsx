import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { ProductDetailSurface } from "../pages/product-detail-page";

import styles from "./product-detail-drawer.module.css";

export function ProductDetailDrawer({
  productId,
  open,
  onClose,
}: Readonly<{
  productId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, productId);

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
      title="产品详情"
      onClose={handleClose}
    >
      <ProductDetailSurface productId={productId} onClose={handleClose} />
    </Drawer>
  );
}
