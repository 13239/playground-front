"use client";

import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import type { RoomDraft } from "../contracts";
import styles from "./gomoku.module.css";

/** 방 생성·수정은 같은 입력과 주석을 공유하고 기존 비공개 방에서만 비밀번호 유지 안내를 제공한다. */
export function RoomSettingsFields({ draft, errors, disabled, preservePassword = false, onChange: update }: {
  draft: RoomDraft;
  errors: Readonly<Record<string, string>>;
  disabled: boolean;
  preservePassword?: boolean;
  onChange: (patch: Partial<RoomDraft>) => void;
}) {
  return (
    <fieldset
      disabled={disabled}
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
          {/* 글자 수 표시까지 포함한 방 이름 입력 영역의 테두리를 함께 강조한다. */}
          <div data-focus-frame className={styles.titleInput}>
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
            placeholder={preservePassword ? "변경할 때만 새 비밀번호를 입력하세요" : "4~8자의 숫자 또는 영문을 입력하세요"}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "password-error" : "password-help"
            }
            onChange={(event) => update({ password: event.target.value })}
          />
          <small id="password-help">{preservePassword ? "비워두면 기존 비밀번호를 유지해요." : "비공개 방은 영문 또는 숫자 4~8자의 비밀번호가 필요해요."}</small>
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
  );
}
