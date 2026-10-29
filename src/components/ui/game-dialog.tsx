"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import styles from "./game-dialog.module.css";

/** 브라우저 기본 dialog로 포커스·Escape·배경 비활성화를 처리하고 요청 중에는 중복 닫기를 막는다. */
export function RoomDialog({
  title,
  children,
  onClose,
  busy = false,
  showClose = true,
  className,
  illustration,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  showClose?: boolean;
  // 새 팝업이 공통 동작을 유지하면서 자신에게 필요한 반응형 배치만 보완할 수 있다.
  className?: string;
  // 캐릭터 안내가 필요한 팝업도 기존 모달의 접근성·Escape·요청 중 닫기 방지를 그대로 공유한다.
  illustration?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // 실제 표시 문서로 포털을 옮겨 게임 버튼의 스타일이 공통 초대창에 전파되지 않게 한다.
  const [owner, setOwner] = useState<Document>();
  const bindOwner = useCallback((node: HTMLSpanElement | null) => {
    if (node) setOwner(node.ownerDocument);
  }, []);
  useEffect(() => showModalWithoutCloseFocus(ref.current), [owner]);
  const content = (
    <dialog
      ref={ref}
      className={[styles.dialog, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-busy={busy}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className={styles.dialogHeading}>
        {illustration && <div data-dialog-illustration>{illustration}</div>}
        <h2 id={titleId}>{title}</h2>
        {showClose && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
  return (
    <>
      <span hidden ref={bindOwner} />
      {owner && createPortal(content, owner.fullscreenElement ?? owner.body)}
    </>
  );
}
