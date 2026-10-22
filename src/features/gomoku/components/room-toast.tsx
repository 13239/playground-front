"use client";

import { useEffect, useEffectEvent } from "react";
import { createPortal } from "react-dom";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./room-toast.module.css";

/** 짧은 입장 실패는 상단 중앙 토스트로 2초간 표시하며 배경 조작과 현재 입력 포커스를 유지한다. */
export function RoomToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  // 부모의 입력·상태 변경으로 콜백이 바뀌어도 알림이 처음 표시된 시점의 2초 만료는 연장하지 않는다.
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (typeof document === "undefined") return null;
  // 패널의 배경 필터·배치에 영향을 받지 않고 실제 화면 상단에 표시하며 별도의 확인·닫기 버튼은 두지 않는다.
  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
      <span className={styles.symbol} aria-hidden="true"><LobbyIcon name="search" /></span>
      <p>{message}</p>
    </div>,
    document.body,
  );
}
