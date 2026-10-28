"use client";

import { useEffect, useId, useRef } from "react";
import styles from "../../auth.module.css";

type LoginRestrictionDialogProps = {
  ready: boolean;
  message: string;
  onClose: () => void;
};

/** 실제 로그인 차단 응답만 표시하고 기본 dialog의 포커스 격리와 Escape 동작을 사용한다. */
export function LoginRestrictionDialog({ ready, message, onClose }: LoginRestrictionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    // 탭 복귀로 로그인 상태를 재확인할 때는 숨겨진 폼 위에 모달을 남기지 않는다.
    if (ready) dialog?.showModal();
    return () => { dialog?.close(); };
  }, [ready]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); onClose(); }}
    >
      <h2 id={`${id}-title`}>로그인 제한</h2>
      {/* 관리자 문구는 HTML로 해석하거나 다른 안내를 덧붙이지 않는다. */}
      <p id={`${id}-description`} className={styles.restrictionMessage}>{message}</p>
      <button type="button" className={styles.dialogClose} onClick={onClose} autoFocus>
        확인
      </button>
    </dialog>
  );
}
