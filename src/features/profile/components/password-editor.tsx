"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { changePassword, AuthRequestError } from "@/features/auth/client/api";
import { validatePasswordChange } from "@/features/auth/password-validation";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import styles from "./profile.module.css";

type PasswordField = "currentPassword" | "newPassword" | "confirmation";
const fields = [
  { name: "currentPassword", label: "현재 비밀번호", autoComplete: "current-password" },
  { name: "newPassword", label: "새 비밀번호", autoComplete: "new-password" },
  { name: "confirmation", label: "새 비밀번호 확인", autoComplete: "new-password" },
] as const;

/** 현재 비밀번호를 확인한 뒤 변경에 성공하면 창을 닫고 성공 알림만 남긴다. */
export function PasswordEditor({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [values, setValues] = useState<Record<PasswordField, string>>({ currentPassword: "", newPassword: "", confirmation: "" });
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => showModalWithoutCloseFocus(dialogRef.current), []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation: Partial<Record<PasswordField, string>> = validatePasswordChange(values);
    if (!values.confirmation || values.confirmation !== values.newPassword) validation.confirmation = "새 비밀번호와 일치하도록 입력해 주세요.";
    setErrors(validation);
    setError("");
    if (Object.keys(validation).length) {
      const first = fields.find(field => validation[field.name]);
      if (first) dialogRef.current?.querySelector<HTMLInputElement>(`[name="${first.name}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      // 확인 입력은 서버로 보내지 않고 원문을 저장소·URL·알림에 남기지 않는다.
      await changePassword(sessionId, { currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues({ currentPassword: "", newPassword: "", confirmation: "" });
      onSaved();
      dialogRef.current?.close();
    } catch (error) {
      if (error instanceof AuthRequestError && error.code === "CURRENT_PASSWORD_INVALID") {
        setErrors({ currentPassword: error.message });
      } else if (error instanceof AuthRequestError && error.code === "PASSWORD_UNCHANGED") {
        setErrors({ newPassword: error.message });
      } else if (error instanceof AuthRequestError && error.fieldErrors) {
        setErrors(Object.fromEntries(fields.filter(field => error.fieldErrors?.[field.name]).map(field => [field.name, error.fieldErrors?.[field.name]])));
        setError(error.message);
      } else setError(error instanceof AuthRequestError ? error.message : "비밀번호를 변경하지 못했어요. 다시 시도해 주세요.");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={`${styles.dialog} ${styles.passwordDialog}`} aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`} onClose={onClose}
      onCancel={(event) => { if (submitting.current) event.preventDefault(); }}>
      <form className={styles.passwordForm} onSubmit={(event) => void save(event)} noValidate>
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>MY PLAYGROUND</p>
            <h2 id={`${id}-title`}>비밀번호 변경</h2>
            <p id={`${id}-description`}>현재 비밀번호를 확인하고 새 비밀번호를 설정해요.</p>
          </div>
          <button type="button" className={styles.closeButton} aria-label="비밀번호 변경 닫기" disabled={pending} onClick={() => dialogRef.current?.close()}>
            <LobbyIcon name="close" />
          </button>
        </div>
        <div className={styles.dialogBody}>
          <fieldset className={styles.passwordFields} disabled={pending}>
            {fields.map(field => (
              <div className={styles.passwordField} key={field.name}>
                <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
                <input id={`${id}-${field.name}`} name={field.name} type="password" autoComplete={field.autoComplete}
                  value={values[field.name]} autoFocus={field.name === "currentPassword"} maxLength={144} required
                  aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : field.name === "newPassword" ? `${id}-rules` : undefined}
                  onChange={(event) => {
                    setValues(previous => ({ ...previous, [field.name]: event.target.value }));
                    setErrors(previous => ({ ...previous, [field.name]: undefined, ...(field.name === "newPassword" && { confirmation: undefined }) }));
                    setError("");
                  }} />
                {field.name === "newPassword" && <small id={`${id}-rules`}>6~72자로 입력해 주세요.</small>}
                {errors[field.name] && <p id={`${id}-${field.name}-error`} className={styles.fieldError} role="alert">{errors[field.name]}</p>}
              </div>
            ))}
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
        <div className={styles.dialogFooter}>
          <div className={styles.passwordActions}>
            <button type="button" className={styles.cancelButton} disabled={pending} onClick={() => dialogRef.current?.close()}>취소</button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              <LobbyIcon name="lock" />{pending ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
