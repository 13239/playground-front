"use client";

import { useId, useRef, type ReactNode } from "react";
import styles from "../login.module.css";

const notices = {
  signup: {
    title: "새로운 모험을 준비하고 있어요",
    description: "회원가입은 곧 열릴 예정이에요. 조금만 기다려 주세요!",
  },
  password: {
    title: "비밀번호 찾기를 준비하고 있어요",
    description: "계정 복구 서비스를 준비 중이에요. 잠시 후 다시 방문해 주세요.",
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
