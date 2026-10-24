"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { RetryButton } from "@/app/_components/retry-button";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { kickRoom, leaveRoom, newRoomRequestId, readWaitingRoom, readyRoom, sendGameAction } from "../client/api";
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

// 인증 재확인으로 화면을 숨겨도 같은 문서·참가의 점유권은 유지하고, 새 로그인에는 이전 점유권을 넘기지 않는다.
type RoomConnection = Readonly<{ roomId: number; sessionId: string; membershipId: string; pageId?: string; denial?: string; denialCode?: string; error?: string }>;

/** 계정·방 경계가 바뀌면 준비 상태와 방 채팅도 새로 만들어 이전 사용자의 정보를 숨긴다. */
export function WaitingRoomScreen({ roomId }: { roomId: number }) {
  const auth = useAuthSession();
  const router = useRouter();
  const [connection, setConnection] = useState<RoomConnection>();
  const stopped = useRef(false);
  // 창 전환의 checking/error는 참가 종료가 아니다. 로그아웃·다른 로그인에서는 기존 컨트롤러를 해제한다.
  const sessionId = auth.status === "authenticated" ? auth.session.sessionId
    : auth.status === "checking" || auth.status === "error" ? connection?.sessionId : undefined;
  const membershipId = connection?.roomId === roomId && connection.sessionId === sessionId ? connection.membershipId : undefined;
  const onMembership = useCallback((sessionId: string, membershipId: string) => {
    setConnection(current => current?.roomId === roomId && current.sessionId === sessionId && current.membershipId === membershipId
      ? current : { roomId, sessionId, membershipId });
  }, [roomId]);
  const onRestore = useCallback(() => router.replace("/games/gomoku"), [router]);
  const onOpened = useCallback((pageId: string) => {
    setConnection(current => current?.roomId === roomId && current.sessionId === sessionId && current.membershipId === membershipId
      && (current.pageId !== pageId || current.error || current.denial)
      ? { ...current, pageId, denial: undefined, denialCode: undefined, error: undefined } : current);
  }, [roomId, sessionId, membershipId]);
  const onDenied = useCallback((error: unknown) => {
    setConnection(current => current?.roomId === roomId && current.sessionId === sessionId && current.membershipId === membershipId
      ? { ...current, denial: error instanceof AuthRequestError ? error.message : "방 접속을 확인하지 못했습니다.",
        denialCode: error instanceof AuthRequestError ? error.code : undefined } : current);
  }, [roomId, sessionId, membershipId]);
  const onError = useCallback((error: unknown) => {
    // 입장 실패를 준비 버튼만 꺼진 상태로 감추지 않고, 현재 참가에 해당하는 공개 오류만 표시한다.
    setConnection(current => current?.roomId === roomId && current.sessionId === sessionId && current.membershipId === membershipId
      ? { ...current, error: error instanceof AuthRequestError ? error.message : "방 입장을 확인하지 못했습니다. 다시 연결해 주세요." } : current);
    if (error instanceof AuthRequestError && (error.status === 401 || error.code === "LOGIN_SESSION_CHANGED")) revalidateAuthSession();
  }, [roomId, sessionId, membershipId]);
  // 화면 내부의 인증 상태·채팅 재생성과 독립적으로 pagehide·새로고침·뒤로가기와 Web Lock을 관리한다.
  const departure = useRoomDeparture({ sessionId, roomId, membershipId, stopped, onRestore, onOpened, onDenied, onError });
  if (auth.status === "authenticated") {
    const current = connection?.roomId === roomId && connection.sessionId === auth.session.sessionId ? connection : undefined;
    if (current?.denial) return (
      <div className={styles.fallback} role="status">
        <LobbyIcon name="board" />
        <h1>대기실을 확인해 주세요</h1>
        <p>{current.denial}</p>
        {/* 실제 다른 탭의 점유가 해제되면 화면을 떠나지 않고 서버 검증부터 다시 진행한다. */}
        {current.denialCode === "ROOM_PAGE_IN_USE" && (
          <button type="button" className={common.primaryButton} onClick={() => {
            setConnection(previous => previous === current
              ? { ...previous, pageId: undefined, denial: undefined, denialCode: undefined, error: undefined } : previous);
            departure.retry();
          }}>다시 연결</button>
        )}
        <Link className={current.denialCode === "ROOM_PAGE_IN_USE" ? common.secondaryButton : common.primaryButton} href="/games/gomoku">방 목록으로</Link>
      </div>
    );
    return (
      <AuthenticatedWaitingRoom
        key={`${roomId}:${auth.session.sessionId}`}
        roomId={roomId}
        sessionId={auth.session.sessionId}
        pageId={current?.pageId}
        connectionError={current?.error}
        onRetryConnection={departure.retry}
        stopped={stopped}
        onMembership={onMembership}
        onComplete={departure.complete}
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
        <RetryButton className={common.primaryButton} label="다시 확인" onRetry={revalidateAuthSession} retryAt={auth.retryAt} pending={auth.pending} />
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
  pageId,
  connectionError,
  onRetryConnection,
  stopped: stoppedRef,
  onMembership,
  onComplete,
}: {
  roomId: number;
  sessionId: string;
  pageId?: string;
  connectionError?: string;
  onRetryConnection: () => void;
  stopped: RefObject<boolean>;
  onMembership: (sessionId: string, membershipId: string) => void;
  onComplete: (sessionId: string, membershipId: string) => void;
}) {
  const router = useRouter();
  // 서버 응답과 수신 시각을 함께 보관해 팝업 이동으로 시계가 다시 만들어져도 경과 시간을 유지한다.
  const [snapshot, setSnapshot] = useState<{ room: WaitingRoom; receivedAt: number }>();
  const room = snapshot?.room;
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false);
  const [pending, setPending] = useState<"ready" | "leave" | "kick" | "game" | null>(null);
  // 확인 중 다른 사용자가 같은 좌석에 들어오면 이전 선택을 취소하도록 당시 revision을 함께 보관한다.
  const [kickTarget, setKickTarget] = useState<Readonly<{ participant: WaitingParticipant; revision: number }>>();
  const [kickMode, setKickMode] = useState<"allow" | "block" | null>(null);
  const [kickError, setKickError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const mounted = useRef(false);
  const busy = useRef(false);
  const revision = useRef(-1);
  const codeRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const accept = useCallback((next: WaitingRoom) => {
    // 먼저 끝난 준비 요청보다 오래된 조회 응답이 UI를 되돌리지 못하게 한다.
    // 첫 참가 정보가 도착하기 전에 뒤로간 경우에도 늦은 응답의 참가 식별자로 해당 입장만 정리한다.
    if (stoppedRef.current) {
      if (window.location.pathname !== `/games/gomoku/rooms/${roomId}`) {
        void leaveRoom(sessionId, roomId, next.membershipId, newRoomRequestId()).catch(() => {});
      }
      return;
    }
    if (!mounted.current || next.revision < revision.current) return;
    revision.current = next.revision;
    // 인증 재확인 뒤에도 바깥 수명 관리자가 같은 참가·pageId를 재사용하도록 본인의 참가 정보만 전달한다.
    onMembership(sessionId, next.membershipId);
    setSnapshot({ room: next, receivedAt: performance.now() });
    // 좌석이 같아도 revision이 변경되면 재확인을 받아 새 참가자를 잘못 강퇴하지 않는다.
    setKickTarget(current => current && next.revision === current.revision && next.participants.some(
      p => p.seat === current.participant.seat && p.nickname === current.participant.nickname && !p.self,
    ) && next.status === "WAITING" ? current : undefined);
    setError("");
  }, [sessionId, roomId, stoppedRef, onMembership]);

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
      ["ROOM_NOT_FOUND", "ROOM_CLOSED", "ROOM_NOT_JOINED", "ROOM_KICKED", "ROOM_KICKED_REJOIN_ALLOWED", "ROOM_PAGE_IN_USE"].includes(
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
  // 페이지 OPEN이 서버에서 확정되기 전에는 착수·준비·퇴장을 보내지 않는다.
  const sync = useRoomSync({ sessionId, roomId, pageId, playing: room?.game != null, busy, stopped: stoppedRef, accept, fail });

  async function gameAction(action: GameAction) {
    if (!room?.game || !pageId || busy.current) return;
    busy.current = true; setPending("game");
    try { accept(await sendGameAction(sessionId, room, action, pageId)); }
    catch (failure) {
      // 충돌·불명확한 전송 결과는 판을 복구하되 무르기·금수 안내는 조회 성공으로 지우지 않는다.
      try { accept(await readWaitingRoom(sessionId, roomId, pageId)); } catch { /* 주기 조회가 복구를 이어간다. */ }
      fail(failure);
    } finally { busy.current = false; if (mounted.current) setPending(null); }
  }

  async function recoverResult() {
    if (busy.current || !pageId) return;
    busy.current = true; setPending("game");
    try {
      const current = await readWaitingRoom(sessionId, roomId, pageId);
      // 재접속 예산을 소진한 당사자는 복구 뒤 새 착수를 하지 않고 본인의 연결 종료 결과만 확정한다.
      accept(current.game && current.game.phase !== "FINISHED" ? await sendGameAction(sessionId, current, { action: "DISCONNECT" }, pageId) : current);
      sync.restart();
    } catch (failure) { fail(failure); }
    finally { busy.current = false; if (mounted.current) setPending(null); }
  }

  async function changeReady() {
    const self = room?.participants.find((p) => p.self);
    if (!self || !pageId || busy.current) return;
    busy.current = true;
    setPending("ready");
    try {
      accept(await readyRoom(sessionId, roomId, !self.ready, pageId));
    } catch (failure) {
      fail(failure);
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  }
  function selectKickTarget(participant: WaitingParticipant) {
    if (!room) return;
    setKickError("");
    setKickMode(null);
    setKickTarget({ participant, revision: room.revision });
  }

  async function kick() {
    if (!room || !pageId || !kickTarget || !kickMode || busy.current || pending !== null) return;
    const target = room.participants.find(p => p.seat === kickTarget.participant.seat
      && p.nickname === kickTarget.participant.nickname && !p.self);
    if (!room.participants.some(p => p.self && p.host) || !target || room.game || room.revision !== kickTarget.revision) return;
    busy.current = true;
    setPending("kick");
    setKickError("");
    try {
      accept(await kickRoom(sessionId, roomId, target.seat, kickTarget.revision, pageId, kickMode === "block"));
      if (mounted.current) { setKickTarget(undefined); setKickMode(null); }
    } catch (failure) {
      // 전송 성공 여부가 불명확한 경우 새 참가자가 대상인지 재확인한 후에만 다시 시도할 수 있게 한다.
      if (mounted.current) setKickError(failure instanceof AuthRequestError ? failure.message : "강퇴하지 못했습니다. 다시 확인해 주세요.");
      try { accept(await readWaitingRoom(sessionId, roomId, pageId)); } catch { /* 다음 동기화 주기가 복구한다. */ }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  }

  async function leave() {
    if (busy.current || !room || !pageId) return;
    busy.current = true;
    setPending("leave");
    setLeaveError("");
    try {
      await leaveRoom(sessionId, roomId, room.membershipId, pageId);
      // 이전 로그인에서 늦게 끝난 퇴장은 새 로그인·새 참가의 점유권을 해제하지 않는다.
      onComplete(sessionId, room.membershipId);
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
    // 방장이 아닌 참가자는 코드 값 자체를 받지 않으며 복사할 수도 없다.
    if (!room?.inviteCode || !room.participants.some(p => p.self && p.host)) return;
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

  if (fatal || !room || !snapshot)
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
              void readWaitingRoom(sessionId, roomId, pageId)
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
    !pageId
      ? ["방 입장을 확인하고 있어요", connectionError ? "연결 상태를 확인한 뒤 다시 연결해 주세요." : "확인이 끝나면 준비하기를 누를 수 있어요."]
      : room.participants.length === 1
      ? ["상대를 기다리고 있어요", room.participants.some(p => p.self && p.host) ? "상단 방 코드를 복사해 친구에게 알려주세요." : "다른 참가자가 입장할 때까지 기다려 주세요."]
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
    <div className={room.game ? gameStyles.gameLayout : styles.waitingPage} data-gomoku-game={room.game ? "multiplayer" : undefined}>
      {/* 같은 방의 재대국에서도 대국 컨트롤러를 유지해 열린 팝업와 기존 연결을 재사용한다. */}
      {room.game ? <GameRoom room={{ ...room, game: room.game }} receivedAt={snapshot.receivedAt} pending={pending !== null || !pageId} error={error}
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
          {self.host && room.inviteCode && <div className={styles.roomCode}>
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
          </div>}
        </div>
        {self.host && room.inviteCode && copyFallback && (
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
          <ParticipantCard participant={ordered[0]} canKick={self.host && !ordered[0].self} kickDisabled={!pageId || pending !== null}
            onKick={() => selectKickTarget(ordered[0])} />
          <div className={styles.versus} aria-hidden="true">
            <span>✦</span>
            <strong>VS</strong>
            <span>✧</span>
          </div>
          <ParticipantCard participant={ordered[1]} canKick={self.host && !!ordered[1] && !ordered[1].self} kickDisabled={!pageId || pending !== null}
            onKick={() => selectKickTarget(ordered[1])} />
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
        {connectionError && (
          <div className={styles.error} role="alert">
            <p>{connectionError}</p>
            <button className={common.secondaryButton} type="button" onClick={onRetryConnection}>다시 연결</button>
          </div>
        )}
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
            disabled={!pageId || pending !== null || room.participants.length < 2}
            aria-pressed={self.ready}
          >
            <LobbyIcon name="check" />
            {pending === "ready"
              ? "변경 중…"
              : !pageId
                ? "입장 확인 중…"
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
      {kickTarget && !room.game && self.host && (
        <RoomDialog
          title="강퇴 방식 선택"
          busy={pending === "kick"}
          showClose={false}
          onClose={() => { setKickTarget(undefined); setKickMode(null); setKickError(""); }}
        >
          <p><strong>{kickTarget.participant.nickname}</strong> 님을 정말 강퇴하시겠어요? 강퇴 방식을 선택해 주세요.</p>
          {/* 방장이 한 가지를 명시적으로 선택하기 전에는 강퇴 API를 호출하지 않는다. */}
          <fieldset className={styles.kickChoices} disabled={pending !== null}>
            <legend>재참가 허용 여부</legend>
            <label className={styles.kickChoice} data-selected={kickMode === "allow"}>
              <input type="radio" name="kick-mode" value="allow" checked={kickMode === "allow"}
                onChange={() => setKickMode("allow")} />
              <span><strong>재참가 가능한 강퇴</strong><small>이 방에 다시 입장할 수 있습니다.</small></span>
            </label>
            <label className={styles.kickChoice} data-selected={kickMode === "block"}>
              <input type="radio" name="kick-mode" value="block" checked={kickMode === "block"}
                onChange={() => setKickMode("block")} />
              <span><strong>재참가 불가능한 강퇴</strong><small>이 방이 유지되는 동안 다시 입장할 수 없습니다.</small></span>
            </label>
          </fieldset>
          {kickMode && <p className={styles.kickWarning} role="status">
            {kickMode === "block"
              ? "확인하면 해당 참가자를 즉시 강퇴하고 이 방의 재입장을 금지합니다."
              : "확인하면 해당 참가자를 즉시 강퇴하지만 다시 입장하는 것은 허용합니다."}
          </p>}
          {kickError && <p className={common.error} role="alert">{kickError}</p>}
          <div className={common.actions}>
            <button type="button" className={common.secondaryButton} disabled={pending !== null}
              onClick={() => { setKickTarget(undefined); setKickMode(null); setKickError(""); }}>취소</button>
            <button type="button" className={common.dangerButton} disabled={!pageId || !kickMode || pending !== null}
              onClick={() => void kick()}>{pending === "kick" ? "강퇴 중…" : "선택한 방식으로 강퇴"}</button>
          </div>
        </RoomDialog>
      )}
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
              disabled={!pageId || pending !== null}
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
  canKick = false,
  kickDisabled = false,
  onKick,
}: {
  participant?: WaitingParticipant;
  canKick?: boolean;
  kickDisabled?: boolean;
  onKick?: () => void;
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
      {/* 본인 카드와 빈 좌석에는 강퇴 버튼을 표시하지 않는다. */}
      {canKick && onKick && <button type="button" className={styles.kickButton}
        aria-label={`${participant.nickname} 강퇴`} disabled={kickDisabled} onClick={onKick}>강퇴</button>}
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
