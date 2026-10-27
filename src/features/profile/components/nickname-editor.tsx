"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/error";
import { nicknameError } from "../validation";
import styles from "./profile.module.css";

/** 미리보기 이름 옆에서 닉네임만 저장한다. 아바타 초안은 유지하고 툴팁은 마우스·키보드 모두 지원한다. */
export function NicknameEditor({ nickname, disabled, onSave, onPendingChange }: {
  nickname: string;
  disabled: boolean;
  onSave: (nickname: string) => Promise<void>;
  onPendingChange: (pending: boolean) => void;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function finish() {
    setEditing(false);
    // 저장으로 폼이 닫히면 키보드 포커스를 편집 버튼에 남긴다.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function cancel() {
    // 취소 직후 편집 버튼에 포커스를 주면 툴팁과 포커스 링이 바로 뜬다.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setEditing(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    const validation = nicknameError(value);
    if (validation) { setError(validation); return; }
    if (value === nickname) { finish(); return; }
    submitting.current = true;
    setPending(true);
    onPendingChange(true);
    setError("");
    try {
      await onSave(value);
      finish();
    } catch (error) {
      setError(error instanceof AuthRequestError ? error.fieldErrors?.nickname ?? error.message : "닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      submitting.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }

  if (!editing) return (
    <div className={styles.nicknameRow}>
      <strong>{nickname}</strong>
      <span className={styles.nicknameAction}>
        <button ref={triggerRef} type="button" className={styles.nicknameButton} disabled={disabled}
          aria-label="닉네임 변경" aria-describedby={`${id}-tooltip`}
          onClick={() => { setValue(nickname); setError(""); setEditing(true); }}>
          <LobbyIcon name="edit" />
        </button>
        <span id={`${id}-tooltip`} role="tooltip" className={styles.nicknameTooltip}>닉네임 변경</span>
      </span>
    </div>
  );

  return (
    <form className={styles.nicknameForm} onSubmit={(event) => void save(event)}>
      <label htmlFor={id}>닉네임</label>
      <div className={styles.nicknameControls}>
        <input id={id} value={value} autoFocus autoComplete="nickname" disabled={pending || disabled}
          aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onChange={(event) => { setValue(event.target.value); setError(""); }} />
        <button type="submit" className={`${styles.nicknameButton} ${styles.nicknameSave}`} disabled={pending || disabled} aria-label="닉네임 저장">
          <LobbyIcon name="check" />
        </button>
        <button type="button" className={`${styles.nicknameButton} ${styles.nicknameCancel}`} disabled={pending || disabled} aria-label="닉네임 수정 취소" onClick={cancel}>
          <LobbyIcon name="close" />
        </button>
      </div>
      <small id={`${id}-help`}>{pending ? "저장 중…" : "최대 50자까지 사용할 수 있어요."}</small>
      {error && <p id={`${id}-error`} className={styles.fieldError} role="alert">{error}</p>}
    </form>
  );
}
