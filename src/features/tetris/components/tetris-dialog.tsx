"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./tetris.module.css";

/** 네이티브 모달의 포커스 제한·Escape·원래 버튼 복귀를 사용한다. 배경의 게임 입력은 받지 않는다. */
export function TetrisDialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="tetris-dialog-title"
    >
      <header>
        <h2 id="tetris-dialog-title">{title}</h2>
        <button type="button" onClick={close} aria-label="닫기">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
