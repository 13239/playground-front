"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { leaveRoom, readWaitingRoom, readyRoom, sendGameAction } from "../client/api";
import { useRoomSync } from "../client/use-room-sync";
import { useRoomDeparture } from "../client/use-room-departure";
import type { GameAction } from "../game-contracts";
import type { WaitingParticipant, WaitingRoom } from "../waiting-contracts";
import { RoomDialog } from "./room-dialog";
import { RoomChatPanel } from "./room-chat-panel";
import { GameRoom } from "./game-room";
import gameStyles from "./game-room.module.css";
import common from "./gomoku.module.css";
import styles from "./waiting-room.module.css";

/** 계정·방 경계가 바뀌면 준비 상태와 방 채팅도 새로 만들어 이전 사용자의 정보를 숨긴다. */
export function WaitingRoomScreen({ roomId }: { roomId: number }) {
  const auth = useAuthSession();
  if (auth.status === "authenticated") {
    return (
      <AuthenticatedWaitingRoom
        key={`${roomId}:${auth.session.sessionId}`}
        roomId={roomId}
        sessionId={auth.session.sessionId}
      />
    );
  }
  return (
    <div className={styles.fallback} role="status">
      <LobbyIcon name="board" />
      <h1>오목 대기실</h1>
      <p>
        {auth.status === "error"
          ? auth.message
          : auth.status === "anonymous"
            ? "로그인 후 대기실에 입장해 주세요."
            : "로그인 상태를 확인하고 있어요."}
      </p>
      {auth.status === "error" && (
        <button
          className={common.primaryButton}
          onClick={revalidateAuthSession}
        >
          다시 확인
        </button>
      )}
      {auth.status === "anonymous" && (
        <Link className={common.primaryButton} href="/login">
          로그인
        </Link>
      )}
    </div>
  );
}

function AuthenticatedWaitingRoom({
  roomId,
  sessionId,
}: {
  roomId: number;
  sessionId: string;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<WaitingRoom>();
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false);
  const [pending, setPending] = useState<"ready" | "leave" | "game" | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const mounted = useRef(false);
  const busy = useRef(false);
  const stopped = useRef(false);
  const revision = useRef(-1);
  const codeRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const accept = useCallback((next: WaitingRoom) => {
    // 먼저 끝난 준비 요청보다 오래된 조회 응답이 UI를 되돌리지 못하게 한다.
    // 첫 참가 정보가 도착하기 전에 뒤로간 경우에도 늦은 응답의 참가 식별자로 해당 입장만 정리한다.
    if (stopped.current) {
      if (window.location.pathname !== `/games/gomoku/rooms/${roomId}`) {
        void leaveRoom(sessionId, roomId, next.membershipId).catch(() => {});
      }
      return;
    }
    if (!mounted.current || next.revision < revision.current) return;
    revision.current = next.revision;
    setRoom(next);
    setError("");
  }, [sessionId, roomId]);

  const fail = useCallback((failure: unknown) => {
    if (!mounted.current) return;
    const authError = failure instanceof AuthRequestError ? failure : null;
    if (
      authError?.status === 401 ||
      authError?.code === "LOGIN_SESSION_CHANGED"
    )
      revalidateAuthSession();
    setError(
      authError?.message ??
        "대기실에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.",
    );
    if (
      ["ROOM_NOT_FOUND", "ROOM_CLOSED", "ROOM_NOT_JOINED"].includes(
        authError?.code ?? "",
      )
    )
      setFatal(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(copyTimer.current);
    };
  }, []);
  // 중첩 요청 없이 동기화하고 숨겨진 대기 탭은 접속 리스만 유지하도록 조회 간격을 늘린다.
  // 대국에서는 이벤트 알림·5초 접속 확인·5회 재접속을 공통 훅에서 관리한다.
  const onRestore = useCallback(() => router.replace("/games/gomoku"), [router]);
  const departure = useRoomDeparture({ sessionId, roomId, membershipId: room?.membershipId, stopped, onRestore });
  const sync = useRoomSync({ sessionId, roomId, playing: room?.game != null, busy, stopped, accept, fail });

  async function gameAction(action: GameAction) {
    if (!room?.game || busy.current) return;
    busy.current = true; setPending("game");
    try { accept(await sendGameAction(sessionId, room, action)); }
    catch (failure) {
      // 충돌·불명확한 전송 결과는 판을 복구하되 무르기·금수 안내는 조회 성공으로 지우지 않는다.
      try { accept(await readWaitingRoom(sessionId, roomId)); } catch { /* 주기 조회가 복구를 이어간다. */ }
      fail(failure);
    } finally { busy.current = false; if (mounted.current) setPending(null); }
  }

  async function recoverResult() {
    if (busy.current) return;
    busy.current = true; setPending("game");
    try {
      const current = await readWaitingRoom(sessionId, roomId);
      // 재접속 예산을 소진한 당사자는 복구 뒤 새 착수를 하지 않고 본인의 연결 종료 결과만 확정한다.
      accept(current.game && current.game.phase !== "FINISHED" ? await sendGameAction(sessionId, current, { action: "DISCONNECT" }) : current);
      sync.restart();
    } catch (failure) { fail(failure); }
    finally { busy.current = false; if (mounted.current) setPending(null); }
  }

  async function changeReady() {
    const self = room?.participants.find((p) => p.self);
    if (!self || busy.current) return;
    busy.current = true;
    setPending("ready");
    try {
      accept(await readyRoom(sessionId, roomId, !self.ready));
    } catch (failure) {
      fail(failure);
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  }
  async function leave() {
    if (busy.current || !room) return;
    busy.current = true;
    setPending("leave");
    setLeaveError("");
    try {
      await leaveRoom(sessionId, roomId, room.membershipId);
      departure.complete();
      if (mounted.current) router.replace("/games/gomoku");
    } catch (failure) {
      fail(failure);
      busy.current = false;
      if (mounted.current) {
        setPending(null);
        // 조회 성공이 퇴장 실패 안내를 지우지 않도록 확인 대화상자의 오류는 별도로 유지한다.
        setLeaveError(
          failure instanceof AuthRequestError
            ? failure.message
            : "방에서 나가지 못했습니다. 다시 시도해 주세요.",
        );
      }
    }
  }
  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      if (!mounted.current) return;
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 상단 코드 입력을 직접 선택할 수 있게 제공한다.
      setCopyFallback(true);
      requestAnimationFrame(() => {
        codeRef.current?.focus();
        codeRef.current?.select();
      });
    }
  }

  if (fatal || !room)
    return (
      <div className={styles.fallback} role="status">
        <LobbyIcon name="board" />
        <h1>{fatal ? "대기실을 확인해 주세요" : "대기실에 연결하고 있어요"}</h1>
        <p>{error || "참가자와 방 정보를 불러오고 있어요."}</p>
        {error && !fatal && (
          <button
            className={common.secondaryButton}
            disabled={pending !== null}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setPending("ready");
              void readWaitingRoom(sessionId, roomId)
                .then(accept)
                .catch(fail)
                .finally(() => {
                  busy.current = false;
                  if (mounted.current) setPending(null);
                });
            }}
          >
            다시 확인
          </button>
        )}
        <Link className={common.primaryButton} href="/games/gomoku">
          방 목록으로
        </Link>
      </div>
    );
  // 대기실과 같은 참가·채팅 연결을 유지한 채 시안의 플레이어/판/채팅 3열 대국 화면으로 전환한다.
  const self = room.participants.find((p) => p.self)!;
  const ordered = [...room.participants].sort(
    (a, b) => Number(b.host) - Number(a.host),
  );
  const notice =
    room.participants.length === 1
      ? ["상대를 기다리고 있어요", "상단 방 코드를 복사해 친구에게 알려주세요."]
      : room.allReady
        ? [
            "두 명 모두 준비를 마쳤어요",
            "준비를 취소하려면 아래 버튼을 눌러주세요.",
          ]
        : self.ready
          ? [
              "상대의 준비를 기다리고 있어요",
              "상대가 준비하면 대국 준비가 완료돼요.",
            ]
          : room.participants.some((p) => p.ready)
            ? [
                "상대가 준비를 마쳤어요",
                "준비하기를 눌러 대국 준비를 마쳐주세요.",
              ]
            : ["함께 대국을 준비해요", "준비가 되면 준비하기를 눌러주세요."];

  return (
    <div className={room.game ? gameStyles.gameLayout : styles.waitingPage}>
      {room.game ? <GameRoom key={room.game.id} room={{ ...room, game: room.game }} pending={pending !== null} error={error}
        reconnectAttempt={sync.attempt} connectionLost={sync.lost} onAction={action => void gameAction(action)}
        onLeave={() => { setLeaveError(""); setConfirmLeave(true); }} onRecover={() => void recoverResult()} />
        : <section className={styles.scene} aria-label="오목 대기실">
        <Image
          src="/images/gomoku/waiting-room-background.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1100px) 100vw, 75vw"
          className={styles.sceneImage}
        />
        <div className={styles.roomHeader}>
          <div className={styles.heading}>
            <span className={styles.gameIcon}>
              <LobbyIcon name="board" />
            </span>
            <div>
              <div className={styles.titleRow}>
                <h1>오목 대기실</h1>
                <span className={styles.participantCount}>
                  <LobbyIcon name="users" /> 참가자 {room.participants.length}/2
                </span>
              </div>
              <p title={room.title}>{room.title}</p>
            </div>
          </div>
          <div className={styles.roomCode}>
            <span>
              <LobbyIcon name="link" /> 방 코드
            </span>
            <strong>{room.inviteCode}</strong>
            <button
              type="button"
              onClick={() => void copyCode()}
              aria-label="방 코드 복사"
            >
              <LobbyIcon name={copied ? "check" : "copy"} />
              {copied ? "복사 완료" : "코드 복사"}
            </button>
          </div>
        </div>
        {copyFallback && (
          <label className={styles.manualCopy}>
            코드를 선택해 직접 복사해 주세요.
            <input
              ref={codeRef}
              readOnly
              value={room.inviteCode}
              aria-label="직접 복사할 방 코드"
            />
          </label>
        )}
        <div className={styles.playerRow}>
          <ParticipantCard participant={ordered[0]} />
          <div className={styles.versus} aria-hidden="true">
            <span>✦</span>
            <strong>VS</strong>
            <span>✧</span>
          </div>
          <ParticipantCard participant={ordered[1]} />
        </div>
        <section className={styles.rules} aria-labelledby="waiting-rules-title">
          <h2 id="waiting-rules-title">
            <LobbyIcon name="book" />
            규칙
          </h2>
          <dl className={styles.ruleGrid}>
            <Rule
              icon="board"
              label="바둑판 크기"
              value="20 × 20"
              color="blue"
            />
            <Rule
              icon="clock"
              label="제한 시간"
              value="30초 / 수"
              color="orange"
            />
            <Rule
              icon="undo"
              label="무르기"
              value={`${room.undoLimit}회`}
              color="cyan"
            />
            <Rule
              icon="scale"
              label="금수 규칙"
              value={
                room.forbiddenRule === "STANDARD" ? "금수 적용" : "금수 없음"
              }
              color="green"
              detail={
                room.forbiddenRule === "STANDARD"
                  ? "흑돌 3·3 / 4·4 / 장목"
                  : "자유 룰"
              }
            />
            <Rule
              icon={room.visibility === "PUBLIC" ? "globe" : "lock"}
              label="공개 설정"
              value={room.visibility === "PUBLIC" ? "공개방" : "비공개방"}
              color="green"
            />
          </dl>
          <div className={styles.notice} role="status" aria-live="polite">
            <LobbyIcon name={room.allReady ? "check" : "users"} />
            <div>
              <strong>{notice[0]}</strong>
              <p>{notice[1]}</p>
            </div>
          </div>
        </section>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.roomActions}>
          <button
            className={styles.readyButton}
            type="button"
            onClick={() => void changeReady()}
            disabled={pending !== null || room.participants.length < 2}
            aria-pressed={self.ready}
          >
            <LobbyIcon name="check" />
            {pending === "ready"
              ? "변경 중…"
              : self.ready
                ? "준비 취소"
                : "준비하기"}
          </button>
          <button
            className={styles.leaveButton}
            type="button"
            onClick={() => {
              setLeaveError("");
              setConfirmLeave(true);
            }}
            disabled={pending !== null}
          >
            <LobbyIcon name="exit" />
            나가기
          </button>
        </div>
      </section>}
      <RoomChatPanel key={`${room.id}:${room.membershipId}`} room={room} />
      {confirmLeave && (
        <RoomDialog
          title={room.game ? "방에서 나갈까요?" : "대기실에서 나갈까요?"}
          busy={pending === "leave"}
          showClose={false}
          onClose={() => setConfirmLeave(false)}
        >
          {room.game && <p>{room.game.phase === "FINISHED" ? "방에서 나가면 상대가 새로운 참가자를 기다릴 수 있어요." : "대국 중에 나가면 기권 패배로 기록돼요."}</p>}
          {leaveError && (
            <p className={common.error} role="alert">
              {leaveError}
            </p>
          )}
          <div className={common.actions}>
            <button
              className={common.secondaryButton}
              disabled={pending !== null}
              onClick={() => setConfirmLeave(false)}
            >
              머무르기
            </button>
            <button
              className={common.dangerButton}
              disabled={pending !== null}
              onClick={() => void leave()}
            >
              {pending === "leave" ? "나가는 중…" : "나가기"}
            </button>
          </div>
        </RoomDialog>
      )}
    </div>
  );
}

/** 빈 좌석은 참가자를 꾸며 넣지 않고 실제 입장을 기다리는 상태로 표시한다. */
function ParticipantCard({
  participant,
}: {
  participant?: WaitingParticipant;
}) {
  if (!participant)
    return (
      <article className={`${styles.playerCard} ${styles.emptyPlayer}`}>
        <span className={styles.emptyAvatar}>
          <LobbyIcon name="users" />
        </span>
        <h2>친구를 기다리고 있어요</h2>
        <p>방 코드를 공유해 함께해요.</p>
        <span className={styles.readyState}>입장 대기 중</span>
      </article>
    );
  return (
    <article
      className={`${styles.playerCard} ${participant.self ? styles.selfCard : ""}`}
    >
      {participant.host && <span className={styles.hostBadge}>♛ 방장</span>}
      <div className={styles.avatarCircle}>
        <ProfileAvatar avatarId={participant.avatarId} size={256} />
      </div>
      <h2 title={participant.nickname}>
        {participant.nickname}
        {participant.self && <small>나</small>}
      </h2>
      <span
        className={`${styles.readyState} ${participant.ready ? styles.isReady : ""}`}
      >
        <LobbyIcon name={participant.ready ? "check" : "clock"} />
        {participant.ready ? "준비 완료" : "준비 전"}
      </span>
    </article>
  );
}

function Rule({
  icon,
  label,
  value,
  color,
  detail,
}: {
  icon: Parameters<typeof LobbyIcon>[0]["name"];
  label: string;
  value: string;
  color: string;
  detail?: string;
}) {
  return (
    <div className={styles.ruleTile}>
      <span className={styles.ruleIcon} data-color={color}>
        <LobbyIcon name={icon} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}
