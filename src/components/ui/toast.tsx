"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import styles from "./toast.module.css";

function currentHost() {
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return dialogs.item(dialogs.length - 1) ?? document.body;
}
function observeHost(changed: () => void) {
  const observer = new MutationObserver(changed);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}

/** 폼 배치·입력 초점을 유지하고 열린 모달 위에서도 읽을 수 있는 공통 알림이다. */
export function Toast({ message, tone = "info", duration = 3000, delay = 0, onDismiss }: {
  message: string; tone?: "info" | "success" | "error"; duration?: number | null; delay?: number; onDismiss?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useEffectEvent(() => onDismiss?.());
  const host = useSyncExternalStore(observeHost, currentHost, () => null);
  useEffect(() => {
    const element = ref.current;
    const show = () => { if (element?.isConnected && typeof element.showPopover === "function") element.showPopover(); };
    const timer = window.setTimeout(show, delay);
    return () => {
      window.clearTimeout(timer);
      if (element?.isConnected && typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
    };
  }, [host, delay]);
  useEffect(() => {
    if (duration === null) return;
    const timer = window.setTimeout(() => dismiss(), delay + duration);
    return () => window.clearTimeout(timer);
  }, [duration, delay]);
  if (!host) return null;
  return createPortal(<div ref={ref} popover="manual" className={styles.toast} data-tone={tone} role="status" aria-live="polite" aria-atomic="true">
    <span className={styles.symbol} aria-hidden="true"><Icon name={tone === "success" ? "check" : tone === "error" ? "close" : "question"} /></span>
    <p>{message}</p>
  </div>, host);
}
