"use client";

import { useEffect, useId, useRef } from "react";
import { useRetryCountdown } from "@/lib/client/use-retry-countdown";
import styles from "../auth.module.css";

/** 인증 결과의 공통 확인창. 문구는 평문으로 표시하고 닫기·Escape의 동작을 공유한다. */
export function AuthNoticeDialog({ title, message, ready = true, retryAt, onClose }: {
  title: string; message: string; ready?: boolean; retryAt?: number; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const seconds = useRetryCountdown(retryAt);
  useEffect(() => {
    const dialog = ref.current;
    // 탭 복귀로 인증 상태를 확인하는 동안에는 숨겨진 폼 위에 초점을 가두지 않는다.
    if (ready && dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); };
  }, [ready]);
  return <dialog ref={ref} className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-message`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-message`} className={styles.restrictionMessage}>{message}</p>
    {seconds > 0 && <p className={styles.dialogRetry} aria-live="off">{seconds}초 후 다시 시도할 수 있어요.</p>}
    <button type="button" className={styles.dialogClose} onClick={onClose} autoFocus>확인</button>
  </dialog>;
}
