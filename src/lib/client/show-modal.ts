function focusedCloseButton(dialog: HTMLDialogElement) {
  const view = dialog.ownerDocument.defaultView;
  const focused = dialog.ownerDocument.activeElement;
  if (!view || !(focused instanceof view.HTMLButtonElement)) return null;
  if (!dialog.contains(focused)) return null;
  const label = focused.getAttribute("aria-label");
  if (!label?.endsWith("닫기")) return null;
  return focused;
}

function releaseCloseFocus(dialog: HTMLDialogElement) {
  if (!dialog.isConnected || !focusedCloseButton(dialog)) return;
  if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}

export function showModalWithoutCloseFocus(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  releaseCloseFocus(dialog);
  const view = dialog.ownerDocument.defaultView;
  const frame = view?.requestAnimationFrame(() => releaseCloseFocus(dialog));
  return () => {
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
  };
}
