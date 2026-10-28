"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";
import { AuthRequestError, login } from "@/features/auth/client/api";
import { Icon } from "../../_components/icon";
import { NoticeButton } from "./notice-button";
import { LoginReplacementDialog } from "./login-replacement-dialog";
import { LoginRestrictionDialog } from "./login-restriction-dialog";
import styles from "../../auth.module.css";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LoginForm({ ready }: { ready: boolean }) {
  // 수화 전에는 제출을 막아 JSON BFF 대신 기본 HTML 폼 요청이 전송되지 않도록 한다.
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  // 접속 제한은 일반 입력 오류와 분리해 관리자 안내를 확인창 한 곳에서만 표시한다.
  const [restrictionMessage, setRestrictionMessage] = useState<string>();
  const submitting = useRef(false);
  // 비밀번호는 확인 팝업 동안에도 폼 안에만 유지하고 상태·저장소·로그에 복사하지 않는다.
  const formRef = useRef<HTMLFormElement>(null);

  // 서버가 지정한 재시도 대기 시간을 표시하고 숨겨진 탭에서도 실제 시각을 기준으로 계산한다.
  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetryRemaining(remaining);
      if (!remaining) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  // 현재 React의 제출 이벤트 타입을 사용하고 중복 제출은 렌더링 전에도 즉시 차단한다.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitLogin(false);
  }

  // 오류·취소 후에는 비밀번호를 지우고 모달이 닫힌 다음 실제 입력 필드로 포커스를 되돌린다.
  function clearPassword(restoreFocus = true) {
    const password = formRef.current?.elements.namedItem("password");
    if (password instanceof HTMLInputElement) {
      password.value = "";
      // 제한 확인창이 열릴 때는 포커스를 옮기지 않고 사용자가 확인한 뒤 입력으로 돌려준다.
      if (restoreFocus) requestAnimationFrame(() => { if (password.isConnected) password.focus(); });
    }
  }

  function cancelReplacement() {
    if (submitting.current) return;
    setConfirmationRequired(false);
    setStatus("로그인을 취소했어요. 기존 로그인은 유지됩니다.");
    clearPassword();
  }

  // Escape와 확인 버튼은 안내만 닫으며 비밀번호 입력으로 돌아가 재시도할 수 있게 한다.
  function dismissRestriction() {
    setRestrictionMessage(undefined);
    clearPassword();
  }

  // 첫 요청은 기존 로그인을 보존하며, 확인 버튼에서만 교체 동의와 자격 증명을 다시 전송한다.
  async function submitLogin(replaceExistingSession: boolean) {
    // 탭 복귀 중에는 입력값을 유지하면서 제출만 막고 최신 인증 판별을 기다린다.
    const form = formRef.current;
    if (!form || !ready || submitting.current || Date.now() < retryUntil) return;
    const data = new FormData(form);
    submitting.current = true;
    setPending(true);
    setStatus("");
    setRestrictionMessage(undefined);

    // 자격 증명은 동일 Origin BFF에만 보내며 저장소·로그에 남기지 않는다.
    try {
      await login({
        username: String(data.get("username") ?? ""),
        password: String(data.get("password") ?? ""),
        keepLoggedIn: data.get("keepLoggedIn") === "true",
        replaceExistingSession,
      });
      setConfirmationRequired(false);
      form.reset();
      // 인증 경계에서는 문서를 새로 열어 이전 사용자의 Router Cache도 함께 비운다.
      window.location.replace("/");
    } catch (error) {
      // 유효한 자격 증명으로 확인한 중복 로그인만 팝업을 띄우고, 동의 전에는 자동으로 재시도하지 않는다.
      if (error instanceof AuthRequestError && error.code === "LOGIN_CONFIRMATION_REQUIRED") {
        setConfirmationRequired(true);
        return;
      }
      setConfirmationRequired(false);
      // 서버의 최신 권한 판정은 유지하고 공개된 차단 문구를 덧붙임 없이 평문으로 표시한다.
      if (error instanceof AuthRequestError && error.code === "ACCESS_RESTRICTED") {
        setRestrictionMessage(error.message);
        clearPassword(false);
        return;
      }
      setStatus(error instanceof AuthRequestError ? error.message : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      if (error instanceof AuthRequestError && error.retryAfterSeconds) {
        setRetryUntil(Date.now() + error.retryAfterSeconds * 1000);
        setRetryRemaining(error.retryAfterSeconds);
      }
      // 실패한 비밀번호는 지우고 아이디와 로그인 유지 선택은 재입력을 위해 보존한다.
      clearPassword();
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <form
        ref={formRef}
        className={styles.form}
        method="post"
        onSubmit={handleSubmit}
        onInput={() => { if (!retryRemaining) setStatus(""); }}
        aria-label="로그인"
        aria-busy={pending || !ready}
        aria-describedby="login-status"
      >
        {/* 아이콘과 비밀번호 표시 버튼까지 같은 포커스 프레임을 공유한다. */}
        <div className={styles.fields}>
          <div data-focus-frame className={styles.field}>
            {/* 아이디는 가입 화면과 동일한 사용자 아이콘으로 표시한다. */}
            <Icon name="user" className={styles.fieldIcon} />
            <label className={styles.srOnly} htmlFor="login-identifier">
              아이디
            </label>
            <input
              id="login-identifier"
              name="username"
              type="text"
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              readOnly={pending || !ready}
              className={styles.input}
            />
          </div>

          <div data-focus-frame className={styles.field}>
            <Icon name="lock" className={styles.fieldIcon} />
            <label className={styles.srOnly} htmlFor="login-password">
              비밀번호
            </label>
            <input
              id="login-password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              required
              readOnly={pending || !ready}
              className={`${styles.input} ${styles.passwordInput}`}
            />
            <button
              type="button"
              className={styles.visibilityToggle}
              aria-label="비밀번호 표시"
              aria-pressed={passwordVisible}
              aria-controls="login-password"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Icon name={passwordVisible ? "eye-off" : "eye"} />
            </button>
          </div>
        </div>

        <div className={styles.options}>
          <label className={styles.remember}>
            <input
              name="keepLoggedIn"
              type="checkbox"
              value="true"
              defaultChecked
              disabled={pending || !ready}
              className={styles.checkboxInput}
            />
            <span className={styles.checkboxMark} aria-hidden="true">
              <Icon name="check" />
            </span>
            <span>로그인 상태 유지</span>
          </label>
          <NoticeButton kind="password" className={styles.recoveryLink}>
            비밀번호 찾기
          </NoticeButton>
        </div>

        <button type="submit" className={styles.submitButton} disabled={!hydrated || !ready || pending || retryRemaining > 0}>
          {pending ? "로그인 중…" : "로그인"}
          <Icon name="arrow" />
        </button>

        <p id="login-status" role="status" aria-atomic="true" className={styles.formStatus}>
          {status}
          {retryRemaining > 0 && ` (${retryRemaining}초 후 재시도 가능)`}
        </p>
        <noscript>
          <p className={styles.noScript}>
            로그인 화면을 이용하려면 브라우저에서 JavaScript를 켜 주세요.
          </p>
        </noscript>
      </form>
      {confirmationRequired && (
        <LoginReplacementDialog
          ready={ready}
          pending={pending}
          onCancel={cancelReplacement}
          onConfirm={() => { void submitLogin(true); }}
        />
      )}
      {restrictionMessage !== undefined && (
        <LoginRestrictionDialog ready={ready} message={restrictionMessage} onClose={dismissRestriction} />
      )}
    </>
  );
}
