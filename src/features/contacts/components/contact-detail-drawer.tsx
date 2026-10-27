import { Drawer } from "antd";

import { useDetailDrawerFocusRestore } from "~/shared/hooks/use-detail-drawer-focus-restore";

import { ContactDetailSurface } from "../pages/contact-detail-page";

import styles from "./contact-detail-drawer.module.css";

export function ContactDetailDrawer({
  contactId,
  open,
  onClose,
}: Readonly<{
  contactId: number | null;
  open: boolean;
  onClose(): void;
}>) {
  const { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore } =
    useDetailDrawerFocusRestore(open, contactId);

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
      title="联系人详情"
      onClose={handleClose}
    >
      <ContactDetailSurface contactId={contactId} onClose={handleClose} />
    </Drawer>
  );
}
