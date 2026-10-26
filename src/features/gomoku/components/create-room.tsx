"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { RetryButton } from "@/app/_components/retry-button";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { createRoom, newRoomRequestId } from "../client/api";
import { GameEntryGate } from "@/features/games/components/game-entry-gate";
import {
  defaultRoomDraft,
  ruleLabel,
  validateRoomDraft,
  type HostedRoom,
  type RoomDraft,
} from "../contracts";
import { RoomSettingsFields } from "./room-settings-fields";
import { RoomHero } from "./room-artwork";
import styles from "./gomoku.module.css";
import { useGomokuCatalog } from "../client/use-gomoku-catalog";

/** 선택 중 미리보기만 바꾸고 저장은 인증된 서버 응답이 성공한 뒤 확정한다. */
export function CreateRoom() {
  const auth = useAuthSession();
  const { error, refresh } = useGomokuCatalog();
  return (
    <div className={styles.createPage}>
      <RoomHero create />
      {/* 공개 정보 조회만 실패한 경우 폼·입력은 보존하고 표시 정보를 직접 다시 확인할 수 있게 한다. */}
      {error && <div className={styles.catalogNotice}><button type="button" className={styles.secondaryButton} onClick={refresh}>게임 정보 다시 확인</button></div>}
      {auth.status === "authenticated" ? (
        <GameEntryGate key={auth.session.sessionId} game="GOMOKU" mode="ONLINE" sessionId={auth.session.sessionId}>
        <AuthenticatedCreateRoom
          key={auth.session.sessionId}
          sessionId={auth.session.sessionId}
        />
        </GameEntryGate>
      ) : (
        <div className={styles.empty} role="status">
          <h2>{auth.status === "error" ? "로그인 확인 필요" : "로그인 상태 확인 중"}</h2>
          <p>
            {auth.status === "error" ? auth.message : "잠시만 기다려 주세요."}
          </p>
          {auth.status === "error" && (
            <RetryButton className={styles.secondaryButton} label="다시 확인" onRetry={revalidateAuthSession} retryAt={auth.retryAt} pending={auth.pending} />
          )}
        </div>
      )}
    </div>
  );
}

function AuthenticatedCreateRoom({ sessionId }: { sessionId: string }) {
  const { name, online } = useGomokuCatalog();
  const [draft, setDraft] = useState<RoomDraft>(defaultRoomDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<HostedRoom>();
  const requestId = useRef<string | undefined>(undefined);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  function update(patch: Partial<RoomDraft>) {
    requestId.current = undefined;
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
    setFailure("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 생성 폼을 유지한 채 현재 표시 정책으로 신규 생성만 제한하며 서버에서도 다시 확인한다.
    if (submitting.current || !online.available) return;
    const fieldErrors = validateRoomDraft(draft);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)
        ?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setFailure("");
    try {
      requestId.current ??= newRoomRequestId();
      const room = await createRoom(sessionId, requestId.current, {
          ...draft,
          title: draft.title.trim(),
        });
      setCreated(room);
      // 생성된 방의 방장은 서버에서 참가 등록을 끝냈으므로 실제 대기실로 바로 이동한다.
      router.replace(`/games/gomoku/rooms/${room.id}`);
      setDraft((current) => ({ ...current, password: "" }));
    } catch (error) {
      if (error instanceof AuthRequestError) {
        if (error.status === 401 || error.code === "LOGIN_SESSION_CHANGED")
          revalidateAuthSession();
        setFailure(error.message);
        setErrors({ ...error.fieldErrors });
        if (error.code === "ROOM_REQUEST_EXPIRED")
          requestId.current = undefined;
      } else setFailure("방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const previewTitle = draft.title.trim() || "방 이름을 입력해 주세요";
  return (
    <div className={styles.createGrid}>
      <form
        ref={formRef}
        className={`${styles.panel} ${styles.roomForm}`}
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-busy={pending}
      >
        <div className={styles.sectionHeading}>
          <LobbyIcon name="gear" />
          <div>
            <h2>방 설정</h2>
            <p>{online.mode?.name ?? "온라인"} · 원하는 규칙과 옵션을 선택하여 {name} 방을 만들어보세요.</p>
          </div>
        </div>
        {!online.available && <p className={styles.error} role="status">{online.message}</p>}
        {/* 방 생성과 대기실 수정이 같은 입력·검증 안내를 사용한다. */}
        <RoomSettingsFields draft={draft} errors={errors}
          disabled={pending || Boolean(created) || !online.available} onChange={update} />
        {failure && (
          <div className={styles.formFailure} role="alert">
            <p>{failure}</p>
            {failure.includes("이미 만든 방") && (
              <Link className={styles.textButton} href="/games/gomoku">
                목록에서 내 방 확인하기 <LobbyIcon name="arrow" />
              </Link>
            )}
          </div>
        )}
        {/* 방은 서버에서 정상 생성됐지만 클라이언트 이동이 지연되는 경우에도 직접 복귀 경로를 제공한다. */}
        {created && (
          <p className={styles.muted} role="status">
            방이 생성됐어요. 화면이 전환되지 않으면{" "}
            <Link className={styles.textButton} href={`/games/gomoku/rooms/${created.id}`}>
              대기실로 이동
            </Link>
            해 주세요.
          </p>
        )}
        <div className={styles.actions}>
          <Link
            className={styles.secondaryButton}
            aria-disabled={pending}
            tabIndex={pending ? -1 : undefined}
            href="/games/gomoku"
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            취소
          </Link>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={pending || Boolean(created) || !online.available}
          >
            <LobbyIcon name="plus" />
            {pending ? "방 만드는 중…" : "방 만들기"}
          </button>
        </div>
      </form>
      <aside
        className={`${styles.panel} ${styles.preview}`}
        aria-label="방 미리보기와 설정 요약"
      >
        <div className={styles.sectionHeading}>
          <LobbyIcon name="eye" />
          <div>
            <h2>방 미리보기</h2>
            <p>이렇게 방이 생성되어 게임 목록에 표시됩니다.</p>
          </div>
        </div>
        <article className={styles.previewCard}>
          <div className={styles.previewCover}>
            <Image
              src="/images/gomoku/board-blossoms.webp"
              alt=""
              fill
              sizes="(max-width: 900px) 90vw, 520px"
            />
            <span className={styles.previewVisibility}>
              <LobbyIcon
                name={draft.visibility === "PUBLIC" ? "globe" : "lock"}
              />
              {draft.visibility === "PUBLIC" ? "공개" : "비공개"}
            </span>
          </div>
          <h3>{previewTitle}</h3>
          <div className={styles.ruleBadges}>
            <span>
              <LobbyIcon name="scale" />
              {ruleLabel(draft.forbiddenRule)}
            </span>
            <span>
              <LobbyIcon name="undo" />
              무르기 {draft.undoLimit}회
            </span>
          </div>
        </article>
        <section className={styles.summary}>
          <h3>
            <LobbyIcon name="gear" />
            설정 요약
          </h3>
          <dl>
            <div>
              <dt>
                <LobbyIcon name="user" />방 이름
              </dt>
              <dd>{previewTitle}</dd>
            </div>
            <div>
              <dt>
                <LobbyIcon name="globe" />
                공개 설정
              </dt>
              <dd>{draft.visibility === "PUBLIC" ? "공개 방" : "비공개 방"}</dd>
            </div>
            <div>
              <dt>
                <LobbyIcon name="undo" />
                무르기 횟수
              </dt>
              <dd>{draft.undoLimit}회</dd>
            </div>
            <div>
              <dt>
                <LobbyIcon name="scale" />
                금수 규칙
              </dt>
              <dd>
                {draft.forbiddenRule === "NONE"
                  ? "사용 안 함 (자유 룰)"
                  : "금수 적용"}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
