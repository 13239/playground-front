"use client";
import { useRef, useEffect, type ReactNode } from "react";
import styles from "./shooting.module.css";

/** 전장 위 대화상자는 키보드 포커스를 내부에 유지한다. 종료 때 이전 조작 위치로 돌려준다. */
export function BattleDialog({
  title,
  eyebrow,
  children,
  close,
  wide,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close?(): void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className={styles.overlay}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select,a[href],[tabindex='0']",
            ),
          ).filter(
            (element) =>
              element.getClientRects().length > 0 &&
              element.getAttribute("aria-hidden") !== "true",
          );
          const first = controls[0],
            last = controls.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {close && (
          <button className={styles.close} aria-label="닫기" onClick={close}>
            ×
          </button>
        )}
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
