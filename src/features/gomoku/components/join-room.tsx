"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { joinRoom } from "../client/api";
import { inviteCodePattern } from "../contracts";
import type { JoinRoomReceipt } from "../waiting-contracts";
import { RoomDialog } from "./room-dialog";
import { RoomToast } from "./room-toast";
import styles from "./gomoku.module.css";

export type JoinTarget =
  | Readonly<{ roomId: number; title: string; privateRoom: boolean }>
  | Readonly<{ inviteCode: string }>;

// 닫혀서 입장할 수 없는 코드도 없는 방과 같은 짧은 안내로 처리하고 코드·재시도 버튼을 반복 표시하지 않는다.
const roomNotFoundMessage = "방을 찾을 수 없습니다.";
function joinFailureMessage(failure: unknown): string {
  if (!(failure instanceof AuthRequestError))
    return "방에 입장하지 못했습니다.";
  return ["ROOM_NOT_FOUND", "ROOM_CLOSED"].includes(failure.code ?? "")
    ? roomNotFoundMessage
    : failure.message;
}

/** 공개 입장은 확인창 없이 처리하고 성공 영수증의 방 ID로 이동한 뒤 상세 대기실 상태를 다시 읽는다. */
export function JoinRoomDialog({
  sessionId,
  target,
  onClose,
  onFailure,
}: {
  sessionId: string;
  target: JoinTarget;
  onClose: () => void;
  onFailure?: (message: string) => void;
}) {
  const router = useRouter();
  const privateRoom = "privateRoom" in target && target.privateRoom;
  const [needsPassword, setNeedsPassword] = useState(privateRoom);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(!privateRoom);
  const [error, setError] = useState("");
  const initialRequest = useRef<Promise<JoinRoomReceipt> | undefined>(undefined);
  const submitting = useRef(false);
  const alive = useRef(false);
  const destination =
    "roomId" in target
      ? { roomId: target.roomId }
      : { inviteCode: target.inviteCode };

  useEffect(() => {
    alive.current = true;
    let disposed = false;
    // Strict Mode 재구독도 동일 요청 Promise를 공유해 입장·비밀번호 시도 예산을 중복 사용하지 않는다.
    if (!privateRoom) {
      initialRequest.current ??= joinRoom(
        sessionId,
        "roomId" in target
          ? { roomId: target.roomId }
          : { inviteCode: target.inviteCode },
      );
      void initialRequest.current
        .then((room) => {
          if (!disposed) router.push(`/games/gomoku/rooms/${room.roomId}`);
        })
        .catch((failure) => {
          if (disposed) return;
          if (
            failure instanceof AuthRequestError &&
            failure.code === "ROOM_PASSWORD_REQUIRED"
          )
            setNeedsPassword(true);
          else if (onFailure) onFailure(joinFailureMessage(failure));
          else setError(joinFailureMessage(failure));
          if (
            failure instanceof AuthRequestError &&
            (failure.status === 401 || failure.code === "LOGIN_SESSION_CHANGED")
          )
            revalidateAuthSession();
        })
        .finally(() => {
          if (!disposed) setPending(false);
        });
    }
    return () => {
      disposed = true;
      alive.current = false;
    };
    // 한 대화상자는 생성 시의 방·세션에만 묶이고 다른 대상은 부모의 key로 새로 만든다.
  }, [sessionId, privateRoom, router, target, onFailure]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (needsPassword && !/^[A-Za-z0-9]{4,8}$/.test(password)) {
      setError("비밀번호는 영문 또는 숫자 4~8자로 입력해 주세요.");
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const room = await joinRoom(sessionId, {
        ...destination,
        ...(needsPassword ? { password } : {}),
      });
      if (alive.current) {
        setPassword("");
        router.push(`/games/gomoku/rooms/${room.roomId}`);
      }
    } catch (failure) {
      if (!alive.current) return;
      if (
        failure instanceof AuthRequestError &&
        failure.code === "ROOM_PASSWORD_REQUIRED"
      )
        setNeedsPassword(true);
      const message = joinFailureMessage(failure);
      if (message === roomNotFoundMessage && onFailure) onFailure(message);
      else setError(message);
      if (
        failure instanceof AuthRequestError &&
        (failure.status === 401 || failure.code === "LOGIN_SESSION_CHANGED")
      )
        revalidateAuthSession();
    } finally {
      submitting.current = false;
      if (alive.current) setPending(false);
    }
  }

  // 공개 입장 중에는 기존 확인창을 띄우지 않고, 실패한 경우에만 2초짜리 상단 토스트를 표시한다.
  // 비밀번호 입력 사이 방이 닫혀도 기존 입장 폼 대신 동일한 토스트로 전환한다.
  if (error === roomNotFoundMessage || (!needsPassword && error))
    return <RoomToast message={error} onDismiss={onClose} />;
  if (!needsPassword)
    return pending ? (
      <p className={styles.muted} role="status">
        대기실에 입장하고 있어요.
      </p>
    ) : null;

  return (
    <RoomDialog title="비공개 방 입장" busy={pending} onClose={onClose}>
      <p>{"title" in target ? target.title : `방 코드 ${target.inviteCode}`}</p>
      <form onSubmit={(event) => void submit(event)}>
        {needsPassword && (
          <input
            type="password"
            aria-label="방 비밀번호"
            placeholder="방 비밀번호"
            value={password}
            maxLength={8}
            autoComplete="off"
            autoFocus
            disabled={pending}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {pending && <p role="status">대기실에 입장하고 있어요.</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {!pending && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              취소
            </button>
            <button type="submit" className={styles.primaryButton}>
              입장하기
            </button>
          </div>
        )}
      </form>
    </RoomDialog>
  );
}

/** 초대 코드는 화면 메모리에서만 정규화하며 URL이나 브라우저 저장소에 비밀번호를 남기지 않는다. */
export function InviteRoomEntry() {
  const auth = useAuthSession();
  const [code, setCode] = useState("");
  // 진행 중인 코드를 입력값·새 로그인과 분리해 타이핑이나 인증 변경이 같은 입장을 다시 실행하지 않게 한다.
  const [attempt, setAttempt] =
    useState<
      Readonly<{ sessionId: string; target: Readonly<{ inviteCode: string }> }>
    >();
  const codeInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] =
    useState<Readonly<{ id: number; sessionId: string; message: string }>>();
  const noticeSequence = useRef(0);
  const currentAttempt =
    auth.status === "authenticated" &&
    attempt?.sessionId === auth.session.sessionId
      ? attempt
      : undefined;
  const currentNotice =
    auth.status === "authenticated" &&
    notice?.sessionId === auth.session.sessionId
      ? notice
      : undefined;
  const onFailure = useCallback(
    (message: string) => {
      if (!currentAttempt) return;
      // 실패 요청과 토스트 수명을 분리해 알림이 표시되는 2초 동안에도 코드를 바로 고치거나 다시 제출할 수 있다.
      setAttempt((previous) =>
        previous === currentAttempt ? undefined : previous,
      );
      setNotice({
        id: ++noticeSequence.current,
        sessionId: currentAttempt.sessionId,
        message,
      });
    },
    [currentAttempt],
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentAttempt) return;
    if (auth.status !== "authenticated") return;
    if (!inviteCodePattern.test(code)) {
      setNotice({ id: ++noticeSequence.current, sessionId: auth.session.sessionId, message: "6자리 영문·숫자 방 코드를 확인해 주세요." });
      return;
    }
    setAttempt({
      sessionId: auth.session.sessionId,
      target: { inviteCode: code },
    });
  }
  return (
    <>
      <form
        className={styles.inviteRow}
        onSubmit={submit}
        aria-busy={Boolean(currentAttempt)}
      >
        <label className={styles.srOnly} htmlFor="invite-code">
          초대 코드
        </label>
        <input
          ref={codeInput}
          id="invite-code"
          aria-label="초대 코드"
          placeholder="예) ABC234"
          value={code}
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          disabled={auth.status !== "authenticated" || Boolean(currentAttempt)}
          onChange={(event) => {
            setCode(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            );
          }}
        />
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={
            auth.status !== "authenticated" ||
            code.length !== 6 ||
            Boolean(currentAttempt)
          }
        >
          {currentAttempt ? "확인 중…" : "입장"}
        </button>
      </form>
      {currentNotice && (
        <RoomToast
          key={currentNotice.id}
          message={currentNotice.message}
          onDismiss={() =>
            setNotice((previous) =>
              previous?.id === currentNotice.id ? undefined : previous,
            )
          }
        />
      )}
      {currentAttempt && (
        <JoinRoomDialog
          key={currentAttempt.sessionId + currentAttempt.target.inviteCode}
          sessionId={currentAttempt.sessionId}
          target={currentAttempt.target}
          onFailure={onFailure}
          onClose={() => {
            setAttempt(undefined);
            // 비밀번호 확인창을 직접 취소한 경우에만 입력으로 복귀한다. 토스트 만료는 포커스를 옮기지 않는다.
            requestAnimationFrame(() => codeInput.current?.focus());
          }}
        />
      )}
    </>
  );
}
