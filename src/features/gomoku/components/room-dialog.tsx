"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { closeRoom } from "../client/api";
import type { HostedRoom } from "../contracts";
import styles from "./gomoku.module.css";

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
  useEffect(() => showModalWithoutCloseFocus(ref.current), []);
  return (
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
            <LobbyIcon name="close" />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}

/** 초대 코드는 본인 방에서만 표시한다. 클립보드를 쓸 수 없는 HTTP 환경에는 직접 복사할 수 있는 입력을 제공한다. */
export function HostedRoomDialog({
  room,
  sessionId,
  created = false,
  onClose,
  onRoomClosed,
}: {
  room: HostedRoom;
  sessionId: string;
  created?: boolean;
  onClose: () => void;
  onRoomClosed?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
    } catch {
      codeRef.current?.select();
      setError("선택된 코드를 직접 복사해 주세요.");
    }
  }
  async function closeHostedRoom() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await closeRoom(sessionId, room.id);
      if (onRoomClosed) onRoomClosed();
      else router.replace("/games/gomoku");
    } catch (failure) {
      if (
        failure instanceof AuthRequestError &&
        (failure.status === 401 || failure.code === "LOGIN_SESSION_CHANGED")
      )
        revalidateAuthSession();
      setError(
        failure instanceof AuthRequestError
          ? failure.message
          : "방을 닫지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <RoomDialog
      title={created ? "방이 만들어졌어요!" : "내가 만든 방"}
      onClose={onClose}
      busy={busy}
    >
      <p className={styles.dialogRoomTitle}>{room.title}</p>
      <label className={styles.codeLabel} htmlFor="hosted-invite-code">
        초대 코드
      </label>
      <div className={styles.copyRow}>
        <input
          id="hosted-invite-code"
          ref={codeRef}
          value={room.inviteCode}
          readOnly
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={copyCode}
        >
          <LobbyIcon name="copy" />
          {copied ? "복사 완료" : "복사"}
        </button>
      </div>
      <p className={styles.muted}>친구에게 방 코드를 알려주고 대기실에서 함께 준비해보세요.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {confirmClose ? (
        <div className={styles.closeConfirmation}>
          <p>이 방을 닫을까요? 닫은 후에는 새 방을 만들 수 있어요.</p>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy}
              onClick={() => setConfirmClose(false)}
            >
              돌아가기
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={busy}
              onClick={() => void closeHostedRoom()}
            >
              {busy ? "닫는 중…" : "방 닫기"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => setConfirmClose(true)}
          >
            방 닫기
          </button>
          <Link className={styles.primaryButton} href={`/games/gomoku/rooms/${room.id}`}>대기실로</Link>
        </div>
      )}
    </RoomDialog>
  );
}
