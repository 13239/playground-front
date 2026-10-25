"use client";

import { useId, useRef, type ReactNode } from "react";
import styles from "../../auth.module.css";

const notices = {
  password: {
    title: "비밀번호 찾기를 준비하고 있어요",
    description: "계정 복구 서비스를 준비 중이에요.",
  },
} as const;

type NoticeButtonProps = {
  kind: keyof typeof notices;
  className?: string;
  children: ReactNode;
};

/** Native dialog provides modal focus containment, Escape and focus restoration. */
export function NoticeButton({ kind, className, children }: NoticeButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const notice = notices[kind];

  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        id={id}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <h2 id={`${id}-title`}>{notice.title}</h2>
        <p id={`${id}-description`}>{notice.description}</p>
        <button
          type="button"
          className={styles.dialogClose}
          onClick={() => dialogRef.current?.close()}
        >
          확인
        </button>
      </dialog>
    </>
  );
}
