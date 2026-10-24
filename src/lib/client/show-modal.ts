function focusedCloseButton(dialog: HTMLDialogElement) {
  const view = dialog.ownerDocument.defaultView;
  const focused = dialog.ownerDocument.activeElement;
  if (!view || !(focused instanceof view.HTMLButtonElement)) return null;
  if (!dialog.contains(focused)) return null;
  const label = focused.getAttribute("aria-label");
  if (!label?.endsWith("닫기")) return null;
  return focused;
}

function focusedRadio(dialog: HTMLDialogElement) {
  const view = dialog.ownerDocument.defaultView;
  const focused = dialog.ownerDocument.activeElement;
  if (!view || !(focused instanceof view.HTMLInputElement)) return null;
  if (focused.type !== "radio" || !dialog.contains(focused)) return null;
  return focused;
}

function focusDialog(dialog: HTMLDialogElement) {
  if (!dialog.isConnected) return;
  if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}

function releaseAutomaticFocus(dialog: HTMLDialogElement) {
  if (!focusedCloseButton(dialog) && !focusedRadio(dialog)) return;
  focusDialog(dialog);
}

export function focusWithoutRing(element: HTMLElement) {
  if (element.ownerDocument.activeElement === element) element.blur();
  element.focus({ preventScroll: true, focusVisible: false } as FocusOptions & { focusVisible?: boolean });
}

export function showModalWithoutCloseFocus(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  releaseAutomaticFocus(dialog);
  const view = dialog.ownerDocument.defaultView;
  const frame = view?.requestAnimationFrame(() => releaseAutomaticFocus(dialog));
  return () => {
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
  };
}
