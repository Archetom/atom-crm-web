import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Restores focus to the visible list trigger after a route-driven detail Drawer closes.
 *
 * Route navigation can replace the originating button before Ant Design captures it,
 * so the stable record identifier is retained instead of a detached DOM reference.
 */
export function useDetailDrawerFocusRestore(open: boolean, entityId: number | null) {
  const lastEntityIdRef = useRef<number | null>(null);
  const restoreRequestedRef = useRef(false);

  useLayoutEffect(() => {
    if (open && entityId !== null) lastEntityIdRef.current = entityId;
  }, [entityId, open]);

  const requestFocusRestore = useCallback(() => {
    restoreRequestedRef.current = true;
  }, []);

  const restoreFocus = useCallback(() => {
    function tryFocus(attempt: number): void {
      if (!restoreRequestedRef.current || typeof document === "undefined") return;

      const entityId = lastEntityIdRef.current;
      if (entityId === null) {
        restoreRequestedRef.current = false;
        return;
      }

      const target = [
        ...document.querySelectorAll<HTMLElement>(`[data-detail-trigger-id="${entityId}"]`),
      ].find((element) => element.isConnected && element.getClientRects().length > 0);
      if (target !== undefined) {
        target.focus({ preventScroll: true });
        if (document.activeElement === target) {
          restoreRequestedRef.current = false;
          return;
        }
      }

      if (attempt >= 60 || typeof requestAnimationFrame !== "function") {
        restoreRequestedRef.current = false;
        return;
      }

      requestAnimationFrame(() => tryFocus(attempt + 1));
    }

    tryFocus(0);
  }, []);

  const scheduleFocusRestore = useCallback(() => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(restoreFocus);
    else setTimeout(restoreFocus, 0);
  }, [restoreFocus]);

  const restoreFocusAfterClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) scheduleFocusRestore();
    },
    [scheduleFocusRestore],
  );

  return { requestFocusRestore, restoreFocusAfterClose, scheduleFocusRestore };
}
