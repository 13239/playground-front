"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./admin-saved-toast.module.css";

// 열린 모달 안에서 알림을 읽게 하고 모달을 닫으면 본문으로 옮겨 남은 표시 시간을 유지한다.
function toastHost() {
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return dialogs.item(dialogs.length - 1) ?? document.body;
}
function observeDialogs(changed: () => void) {
  const observer = new MutationObserver(changed);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}

/** 저장 알림은 본문 높이·포커스를 바꾸지 않고 열린 모달 위에서도 3초간 표시한다. */
export function AdminSavedToast({ onDismiss }: { onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useEffectEvent(onDismiss);
  const host = useSyncExternalStore(observeDialogs, toastHost, () => null);
  useEffect(() => {
    const toast = ref.current;
    // 생성·삭제 성공과 모달 제거가 같은 커밋에 일어나면 이전 모달에 붙인 토스트도 문서에서 분리된다.
    // 분리된 요소에는 API를 호출하지 않고 모달 감지가 새 표시 위치로 옮긴 뒤 알림을 연다.
    if (!toast?.isConnected) return;
    // 높은 z-index만으로는 네이티브 dialog 위에 보이지 않으므로 비모달 최상위 레이어를 사용한다.
    toast.showPopover();
    return () => {
      if (toast?.isConnected && toast.matches(":popover-open")) toast.hidePopover();
    };
  }, [host]);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!host) return null;
  return createPortal(<div ref={ref} popover="manual" className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
    <span className={styles.symbol} aria-hidden="true"><LobbyIcon name="check" /></span><p>저장했어요.</p>
  </div>, host);
}
