"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { withdrawAccount, AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { validateAccountWithdrawal } from "@/features/auth/withdrawal-validation";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import styles from "./profile.module.css";
import withdrawal from "./withdrawal-dialog.module.css";

/** 현재 비밀번호를 확인한 본인 요청만 제출하고 성공 후 새 문서에서 로그인 화면을 연다. */
export function WithdrawalDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cleanup = showModalWithoutCloseFocus(dialog.current);
    // 모달이 실제로 열린 뒤 본인 확인 입력에 포커스를 두고 닫기 버튼의 자동 포커스를 피한다.
    password.current?.focus({ preventScroll: true });
    return cleanup;
  }, []);
  // 제출 잠금이 해제된 뒤에만 잘못 입력한 비밀번호 칸으로 포커스를 돌린다.
  useEffect(() => { if (fieldError && !pending) password.current?.focus({ preventScroll: true }); }, [fieldError, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = validateAccountWithdrawal({ currentPassword });
    setFieldError(validation.currentPassword ?? "");
    setError("");
    if (validation.currentPassword) { password.current?.focus(); return; }
    submitting.current = true;
    setPending(true);
    try {
      // 비밀번호는 이 요청에서만 사용하고 저장소·URL·알림·로그에 남기지 않는다.
      await withdrawAccount(sessionId, { currentPassword });
      setCurrentPassword("");
      window.location.replace("/login");
    } catch (failure) {
      if (failure instanceof AuthRequestError && failure.code === "CURRENT_PASSWORD_INVALID") {
        setCurrentPassword("");
        setFieldError(failure.message);
      } else if (failure instanceof AuthRequestError && failure.fieldErrors?.currentPassword) {
        setFieldError(failure.fieldErrors.currentPassword);
      } else if (failure instanceof AuthRequestError && failure.code === "ROLE_PROTECTED") {
        setError("최고 관리자 계정은 탈퇴할 수 없어요.");
      } else setError(failure instanceof AuthRequestError ? failure.message : "회원탈퇴를 처리하지 못했어요. 다시 시도해 주세요.");
      // 종료되었거나 다른 탭에서 교체된 로그인은 현재 화면에서 다시 검증한다.
      if (failure instanceof AuthRequestError && (failure.status === 401 || failure.code === "LOGIN_SESSION_CHANGED")) revalidateAuthSession();
      submitting.current = false;
      setPending(false);
    }
  }

  return <dialog ref={dialog} className={`${styles.dialog} ${styles.passwordDialog} ${withdrawal.dialog}`} aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`} onClose={onClose} onCancel={event => { if (submitting.current) event.preventDefault(); }}>
    <form className={styles.passwordForm} onSubmit={event => void submit(event)} noValidate>
      <div className={styles.dialogHeader}>
        <div><p className={styles.eyebrow}>MY PLAYGROUND</p><h2 id={`${id}-title`}>회원탈퇴</h2><p id={`${id}-description`}>탈퇴 전에 현재 비밀번호를 확인해 주세요.</p></div>
        <button type="button" className={styles.closeButton} aria-label="회원탈퇴 닫기" disabled={pending} onClick={() => dialog.current?.close()}><LobbyIcon name="close" /></button>
      </div>
      <div className={styles.dialogBody}>
        <p className={withdrawal.notice}>탈퇴하면 모든 기기에서 로그아웃되고, 이 계정으로 다시 로그인할 수 없어요. 탈퇴를 계속할까요?</p>
        <fieldset className={styles.passwordFields} disabled={pending}>
          <div className={styles.passwordField}>
            <label htmlFor={`${id}-password`}>현재 비밀번호</label>
            <input ref={password} id={`${id}-password`} name="currentPassword" type="password" autoComplete="current-password" value={currentPassword}
              autoFocus maxLength={144} required aria-invalid={!!fieldError} aria-describedby={fieldError ? `${id}-password-error` : undefined}
              onChange={event => { setCurrentPassword(event.target.value); setFieldError(""); setError(""); }} />
            {fieldError && <p id={`${id}-password-error`} className={styles.fieldError} role="alert">{fieldError}</p>}
          </div>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <div className={styles.dialogFooter}><div className={styles.passwordActions}>
        <button type="button" className={styles.cancelButton} disabled={pending} onClick={() => dialog.current?.close()}>취소</button>
        <button type="submit" className={withdrawal.confirmButton} disabled={pending}>{pending ? "탈퇴 처리 중…" : "회원탈퇴"}</button>
      </div></div>
    </form>
  </dialog>;
}
