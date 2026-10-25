"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import { signUp } from "@/features/auth/client/sign-up";
import { signUpRules, validateSignUpInput } from "@/features/auth/sign-up-validation";
import type { SignUpField, SignUpFieldErrors } from "@/features/auth/types";
import { Icon } from "../../_components/icon";
import styles from "../../auth.module.css";
import signUpStyles from "../sign-up.module.css";

const fields = ["nickname", "username", "password"] as const;
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// 오류 필드로 포커스를 옮겨 키보드와 보조 기술로도 재입력 위치를 확인할 수 있게 한다.
function focusField(form: HTMLFormElement, field: SignUpField) {
  const input = form.elements.namedItem(field);
  if (input instanceof HTMLInputElement) input.focus();
}

/** 원문 비밀번호는 폼에서만 유지하며 중복 제출·서버 오류·재시도 시간을 화면에 반영한다. */
export function SignUpForm({ ready }: { ready: boolean }) {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<SignUpFieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const submitting = useRef(false);

  // 제한 시간은 실제 시각으로 계산하므로 백그라운드 탭의 타이머 지연에도 과도하게 기다리지 않는다.
  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetryRemaining(remaining);
      if (!remaining) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !hydrated || submitting.current || Date.now() < retryUntil) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = validateSignUpInput(Object.fromEntries(fields.map((field) => [field, data.get(field)])));
    if (!result.valid) {
      setErrors(result.errors);
      setStatus("입력한 내용을 확인해 주세요.");
      focusField(form, fields.find((field) => result.errors[field]) ?? "nickname");
      return;
    }

    // 렌더링 전에 잠가 빠른 연속 클릭도 한 번의 가입 요청만 전송한다.
    submitting.current = true;
    setPending(true);
    setErrors({});
    setStatus("");
    try {
      await signUp(result.input);
      form.reset();
      // 아이디·비밀번호를 URL이나 저장소에 남기지 않고 공개 완료 표시만 전달한다.
      window.location.replace("/login?registered=1");
    } catch (error) {
      const fieldErrors: Partial<Record<SignUpField, string>> = {};
      if (error instanceof AuthRequestError) {
        for (const field of fields) {
          if (error.fieldErrors?.[field]) fieldErrors[field] = error.fieldErrors[field];
        }
        if (error.code === "DUPLICATE_USERNAME") fieldErrors.username = error.message;
        if (error.retryAfterSeconds) {
          setRetryUntil(Date.now() + error.retryAfterSeconds * 1000);
          setRetryRemaining(error.retryAfterSeconds);
        }
      }
      setErrors(fieldErrors);
      setStatus(error instanceof AuthRequestError ? error.message : "가입하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      // 실패한 비밀번호만 지우고 닉네임과 아이디는 재입력을 위해 보존한다.
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      submitting.current = false;
      setPending(false);
      // pending 동안 비활성화된 입력이 다시 활성화된 다음 포커스를 이동한다.
      window.requestAnimationFrame(() => focusField(form, fields.find((field) => fieldErrors[field]) ?? "password"));
    }
  }

  return (
    <form
      className={styles.form}
      method="post"
      noValidate
      onSubmit={handleSubmit}
      onInput={(event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement && fields.some((field) => field === input.name)) {
          setErrors((previous) => ({ ...previous, [input.name]: undefined }));
          if (!retryRemaining) setStatus("");
        }
      }}
      aria-label="회원가입"
      aria-busy={pending || !ready}
      aria-describedby="sign-up-status"
    >
      <div className={signUpStyles.fields}>
        {fields.map((field) => {
          const rule = signUpRules[field];
          const password = field === "password";
          return (
            <div key={field}>
              <label htmlFor={`sign-up-${field}`} className={signUpStyles.label}>{rule.label}</label>
              {/* 오류 색을 유지하면서 입력 영역 전체에 공통 얇은 테두리를 표시한다. */}
              <div data-focus-frame className={`${styles.field} ${errors[field] ? signUpStyles.invalid : ""}`}>
                {/* 닉네임은 이름표, 로그인 아이디는 사용자 아이콘으로 구분한다. */}
                <Icon name={password ? "lock" : field === "nickname" ? "badge" : "user"} className={styles.fieldIcon} />
                <input
                  id={`sign-up-${field}`}
                  className={`${styles.input} ${password ? styles.passwordInput : ""}`}
                  name={field}
                  type={password && !passwordVisible ? "password" : "text"}
                  autoComplete={password ? "new-password" : field === "nickname" ? "nickname" : "username"}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={password ? "새 비밀번호" : `${rule.label} 입력`}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={`sign-up-${field}-hint${errors[field] ? ` sign-up-${field}-error` : ""}`}
                />
                {password && (
                  <button
                    className={styles.visibilityToggle}
                    type="button"
                    aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 표시"}
                    aria-pressed={passwordVisible}
                    aria-controls="sign-up-password"
                    disabled={!hydrated || pending}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  ><Icon name={passwordVisible ? "eye-off" : "eye"} /></button>
                )}
              </div>
              {/* UTF-16 maxLength 대신 서버와 동일한 코드 포인트 길이를 제출 시 검증한다. */}
              <p id={`sign-up-${field}-hint`} className={signUpStyles.hint}>
                {field === "nickname" ? `최대 ${rule.max}자 · 다른 사람에게 표시되는 이름` : `${rule.min}~${rule.max}자${password ? " · 로그인할 때 사용하는 비밀번호" : " · 로그인할 때 사용하는 아이디"}`}
              </p>
              {errors[field] && <p id={`sign-up-${field}-error`} className={signUpStyles.error}>{errors[field]}</p>}
            </div>
          );
        })}
      </div>
      <button type="submit" className={styles.submitButton} disabled={!hydrated || !ready || pending || retryRemaining > 0}>
        {pending ? "가입하고 있어요…" : retryRemaining ? `${retryRemaining}초 후 다시 시도` : "가입하기"}
        {!pending && !retryRemaining && <Icon name="arrow" />}
      </button>
      <p id="sign-up-status" role="status" className={styles.formStatus}>{status}</p>
    </form>
  );
}
