"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { createRoom, newRoomRequestId } from "../client/api";
import {
  defaultRoomDraft,
  ruleLabel,
  validateRoomDraft,
  type HostedRoom,
  type RoomDraft,
} from "../contracts";
import { HostedRoomDialog } from "./room-dialog";
import { RoomHero } from "./room-artwork";
import styles from "./gomoku.module.css";

/** 선택 중 미리보기만 바꾸고 저장은 인증된 서버 응답이 성공한 뒤 확정한다. */
export function CreateRoom() {
  const auth = useAuthSession();
  return (
    <div className={styles.createPage}>
      <RoomHero create />
      {auth.status === "authenticated" ? (
        <AuthenticatedCreateRoom
          key={auth.session.sessionId}
          sessionId={auth.session.sessionId}
        />
      ) : (
        <div className={styles.empty} role="status">
          <h2>로그인 상태 확인 중</h2>
          <p>
            {auth.status === "error" ? auth.message : "잠시만 기다려 주세요."}
          </p>
          {auth.status === "error" && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={revalidateAuthSession}
            >
              다시 확인
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AuthenticatedCreateRoom({ sessionId }: { sessionId: string }) {
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
    if (submitting.current) return;
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
      setCreated(
        await createRoom(sessionId, requestId.current, {
          ...draft,
          title: draft.title.trim(),
        }),
      );
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
            <p>원하는 규칙과 옵션을 선택하여 오목 방을 만들어보세요.</p>
          </div>
        </div>
        <fieldset
          disabled={pending || Boolean(created)}
          className={styles.formFields}
        >
          <div className={styles.formRow}>
            <label htmlFor="room-title">
              <LobbyIcon name="user" />방 이름{" "}
              <span className={styles.required} aria-hidden="true">
                •
              </span>
            </label>
            <div className={styles.field}>
              <div className={styles.titleInput}>
                <input
                  id="room-title"
                  name="title"
                  value={draft.title}
                  maxLength={30}
                  required
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  onChange={(event) => update({ title: event.target.value })}
                  autoComplete="off"
                />
                <span>{draft.title.length}/30</span>
              </div>
              {errors.title && (
                <p id="title-error" className={styles.error}>
                  {errors.title}
                </p>
              )}
            </div>
          </div>
          <div className={styles.formRow}>
            <span className={styles.fieldLabel} id="visibility-label">
              <LobbyIcon name="lock" />
              공개 설정{" "}
              <span className={styles.required} aria-hidden="true">
                •
              </span>
            </span>
            <div
              className={styles.visibilityOptions}
              role="group"
              aria-labelledby="visibility-label"
            >
              <button
                type="button"
                aria-pressed={draft.visibility === "PUBLIC"}
                onClick={() => update({ visibility: "PUBLIC", password: "" })}
              >
                <LobbyIcon name="globe" />
                <span>
                  <strong>공개 방</strong>
                  <small>누구나 찾아서 참여할 수 있어요</small>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={draft.visibility === "PRIVATE"}
                onClick={() => update({ visibility: "PRIVATE" })}
              >
                <LobbyIcon name="lock" />
                <span>
                  <strong>비공개 방</strong>
                  <small>비밀번호를 아는 사람만 참여할 수 있어요</small>
                </span>
              </button>
            </div>
          </div>
          <div className={styles.formRow}>
            <label
              htmlFor="room-password"
              className={
                draft.visibility === "PUBLIC" ? styles.disabledLabel : undefined
              }
            >
              <LobbyIcon name="lock" />방 비밀번호
            </label>
            <div className={styles.field}>
              <input
                id="room-password"
                name="password"
                type="password"
                maxLength={8}
                value={draft.password}
                disabled={draft.visibility === "PUBLIC"}
                autoComplete="new-password"
                placeholder="4~8자의 숫자 또는 영문을 입력하세요"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                onChange={(event) => update({ password: event.target.value })}
              />
              {errors.password && (
                <p id="password-error" className={styles.error}>
                  {errors.password}
                </p>
              )}
            </div>
          </div>
          <div className={styles.formRow}>
            <span id="undo-label" className={styles.fieldLabel}>
              <LobbyIcon name="undo" />
              무르기 횟수
            </span>
            <div className={styles.undoField}>
              <div
                className={styles.segmentButtons}
                role="group"
                aria-labelledby="undo-label"
              >
                {([1, 3, 5] as const).map((count) => (
                  <button
                    type="button"
                    key={count}
                    aria-pressed={draft.undoLimit === count}
                    onClick={() => update({ undoLimit: count })}
                  >
                    {count}회
                  </button>
                ))}
              </div>
              <small>대국 중 무르기를 요청할 수 있는 횟수입니다.</small>
            </div>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="forbidden-rule">
              <LobbyIcon name="scale" />
              금수 규칙
            </label>
            <div className={styles.field}>
              <select
                id="forbidden-rule"
                name="forbiddenRule"
                value={draft.forbiddenRule}
                onChange={(event) =>
                  update({
                    forbiddenRule:
                      event.target.value === "STANDARD" ? "STANDARD" : "NONE",
                  })
                }
              >
                <option value="NONE">사용 안 함 (자유 룰)</option>
                <option value="STANDARD">금수 적용 (3·3, 4·4, 장목)</option>
              </select>
              <small>금수 적용 시 흑돌의 3·3, 4·4, 장목을 제한해요.</small>
            </div>
          </div>
        </fieldset>
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
            disabled={pending || Boolean(created)}
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
      {created && (
        <HostedRoomDialog
          room={created}
          sessionId={sessionId}
          created
          onClose={() => router.replace("/games/gomoku")}
        />
      )}
    </div>
  );
}
