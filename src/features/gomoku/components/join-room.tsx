"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { joinRoom } from "../client/api";
import { inviteCodePattern } from "../contracts";
import type { WaitingRoom } from "../waiting-contracts";
import { RoomDialog } from "./room-dialog";
import styles from "./gomoku.module.css";

export type JoinTarget =
  | Readonly<{ roomId: number; title: string; privateRoom: boolean }>
  | Readonly<{ inviteCode: string }>;

/** 공개 입장은 즉시 처리하고 비공개 코드 입장도 서버가 비밀번호를 요구하면 같은 대화상자에서 검증한다. */
export function JoinRoomDialog({
  sessionId,
  target,
  onClose,
}: {
  sessionId: string;
  target: JoinTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const privateRoom = "privateRoom" in target && target.privateRoom;
  const [needsPassword, setNeedsPassword] = useState(privateRoom);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(!privateRoom);
  const [error, setError] = useState("");
  const initialRequest = useRef<Promise<WaitingRoom> | undefined>(undefined);
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
          if (!disposed) router.push(`/games/gomoku/rooms/${room.id}`);
        })
        .catch((failure) => {
          if (disposed) return;
          if (
            failure instanceof AuthRequestError &&
            failure.code === "ROOM_PASSWORD_REQUIRED"
          )
            setNeedsPassword(true);
          else
            setError(
              failure instanceof AuthRequestError
                ? failure.message
                : "방에 입장하지 못했습니다.",
            );
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
  }, [sessionId, privateRoom, router, target]);

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
        router.push(`/games/gomoku/rooms/${room.id}`);
      }
    } catch (failure) {
      if (!alive.current) return;
      if (
        failure instanceof AuthRequestError &&
        failure.code === "ROOM_PASSWORD_REQUIRED"
      )
        setNeedsPassword(true);
      setError(
        failure instanceof AuthRequestError
          ? failure.message
          : "방에 입장하지 못했습니다.",
      );
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

  return (
    <RoomDialog
      title={needsPassword ? "비공개 방 입장" : "대기실 입장"}
      busy={pending}
      onClose={onClose}
    >
      <p>{"title" in target ? target.title : `방 코드 ${target.inviteCode}`}</p>
      <form onSubmit={(event) => void submit(event)}>
        {needsPassword && (
          <label className={styles.codeLabel}>
            방 비밀번호
            <input
              type="password"
              aria-label="방 비밀번호"
              value={password}
              maxLength={8}
              autoComplete="off"
              autoFocus
              disabled={pending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
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
  const [target, setTarget] = useState<JoinTarget>();
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteCodePattern.test(code)) {
      setError("6자리 영문·숫자 방 코드를 확인해 주세요.");
      return;
    }
    if (auth.status === "authenticated") {
      setTarget({ inviteCode: code });
      setError("");
    }
  }
  return (
    <>
      <form className={styles.inviteRow} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="invite-code">
          초대 코드
        </label>
        <input
          id="invite-code"
          aria-label="초대 코드"
          placeholder="예) ABC234"
          value={code}
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          disabled={auth.status !== "authenticated"}
          onChange={(event) => {
            setCode(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            );
            setError("");
          }}
        />
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={auth.status !== "authenticated" || code.length !== 6}
        >
          입장
        </button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {target && auth.status === "authenticated" && (
        <JoinRoomDialog
          key={auth.session.sessionId + code}
          sessionId={auth.session.sessionId}
          target={target}
          onClose={() => setTarget(undefined)}
        />
      )}
    </>
  );
}
