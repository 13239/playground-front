"use client";

import { useEffect, useId, useRef } from "react";
import styles from "../../auth.module.css";

type LoginReplacementDialogProps = {
  ready: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 기본 포커스는 취소에 두고, 교체 요청 중에는 Escape·중복 클릭으로 결과를 오인하지 않게 한다. */
export function LoginReplacementDialog({ ready, pending, onConfirm, onCancel }: LoginReplacementDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    // 탭 복귀로 세션을 다시 확인하는 동안에는 모달도 닫아 숨겨진 폼 대신 포커스를 가두지 않는다.
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
      aria-busy={pending}
      onCancel={event => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={`${id}-title`}>다른 곳에서 로그인 중이에요</h2>
      <p id={`${id}-description`}>
        계속 로그인하면 기존 로그인이 종료됩니다.
        <br />
        기존 로그인을 종료하고 계속할까요?
      </p>
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.dialogClose} ${styles.dialogCancel}`} onClick={onCancel} disabled={pending || !ready} autoFocus>
          취소
        </button>
        <button type="button" className={styles.dialogClose} onClick={onConfirm} disabled={pending || !ready}>
          {pending ? "로그인 중…" : "계속 로그인"}
        </button>
      </div>
    </dialog>
  );
}
