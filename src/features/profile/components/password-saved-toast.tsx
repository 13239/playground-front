"use client";

import { useEffect, useEffectEvent } from "react";
import { createPortal } from "react-dom";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./password-saved-toast.module.css";

/** 비밀번호 변경 성공은 창을 닫은 뒤 상단 토스트로 2초간 알린다. */
export function PasswordSavedToast({ onDismiss }: { onDismiss: () => void }) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
      <span className={styles.symbol} aria-hidden="true"><LobbyIcon name="check" /></span>
      <p>비밀번호를 변경했어요.</p>
    </div>,
    document.body,
  );
}
