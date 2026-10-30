"use client";

import { useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";
import { AuthRequestError, login } from "@/features/auth/client/api";
import { Toast } from "@/components/ui/toast";
import { useRetryCountdown } from "@/lib/client/use-retry-countdown";
import { AuthNoticeDialog } from "../../_components/auth-notice-dialog";
import { Icon } from "../../_components/icon";
import { NoticeButton } from "./notice-button";
import { LoginReplacementDialog } from "./login-replacement-dialog";
import { LoginRestrictionDialog } from "./login-restriction-dialog";
import styles from "../../auth.module.css";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LoginForm({ ready, registered = false }: { ready: boolean; registered?: boolean }) {
  // 수화 전에는 제출을 막아 JSON BFF 대신 기본 HTML 폼 요청이 전송되지 않도록 한다.
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; tone: "info" | "error" | "success"; duration?: number } | undefined>(
    registered ? { id: 0, message: "가입이 완료됐어요. 새 계정으로 로그인해 주세요.", tone: "success" } : undefined,
  );
  const toastSequence = useRef(1);
  const [invalidField, setInvalidField] = useState<"username" | "password">();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const retryRemaining = useRetryCountdown(retryUntil);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  // 관리자가 설정한 접속 제한은 장애 안내와 구분해 기존 확인창으로 표시한다.
  const [restrictionMessage, setRestrictionMessage] = useState<string>();
  const submitting = useRef(false);
  // 비밀번호는 확인 팝업 동안에도 폼 안에만 유지하고 상태·저장소·로그에 복사하지 않는다.
  const formRef = useRef<HTMLFormElement>(null);

  function showToast(message: string, tone: "info" | "error" = "info", duration = 3000) {
    setToast({ id: toastSequence.current++, message, tone, duration });
  }

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
      if (restoreFocus) requestAnimationFrame(() => { if (password.isConnected) password.focus(); });
    }
  }

  function cancelReplacement() {
    if (submitting.current) return;
    setConfirmationRequired(false);
    showToast("로그인을 취소했어요. 기존 로그인은 유지됩니다.");
    clearPassword();
  }

  function dismissRestriction() {
    setRestrictionMessage(undefined);
    clearPassword();
  }

  function dismissServerError() {
    setServerError(undefined);
    clearPassword();
  }

  // 첫 요청은 기존 로그인을 보존하며, 확인 버튼에서만 교체 동의와 자격 증명을 다시 전송한다.
  async function submitLogin(replaceExistingSession: boolean) {
    // 탭 복귀 중에는 입력값을 유지하면서 제출만 막고 최신 인증 판별을 기다린다.
    const form = formRef.current;
    if (!form || !ready || submitting.current || Date.now() < retryUntil) return;
    const data = new FormData(form);
    const username = String(data.get("username") ?? ""), password = String(data.get("password") ?? "");
    // 브라우저 기본 검증 풍선 대신 입력 위치와 토스트로 필수 입력을 안내한다. 인증 입력은 변경하지 않는다.
    const missing = !username.trim() ? "username" : !password.trim() ? "password" : undefined;
    if (missing) {
      setInvalidField(missing);
      showToast(missing === "username" ? "아이디를 입력해 주세요." : "비밀번호를 입력해 주세요.", "error");
      const field = form.elements.namedItem(missing);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setToast(undefined);
    setInvalidField(undefined);
    setServerError(undefined);
    setRestrictionMessage(undefined);

    // 자격 증명은 동일 Origin BFF에만 보내며 저장소·로그에 남기지 않는다.
    try {
      await login({
        username,
        password,
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
      if (error instanceof AuthRequestError && error.code === "ACCESS_RESTRICTED") {
        setRestrictionMessage(error.message);
        clearPassword(false);
        return;
      }
      // 운영 정책·교체 확인은 위에서 처리한다. 나머지는 실제 불일치와 서버 장애로 구분한다.
      if (error instanceof AuthRequestError && error.code === "INVALID_CREDENTIALS") {
        showToast("아이디 또는 비밀번호가 올바르지 않습니다.", "error", 2000);
      } else {
        setServerError("서버 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (error instanceof AuthRequestError && error.retryAfterSeconds) {
        setRetryUntil(Date.now() + error.retryAfterSeconds * 1000);
      }
      // 실패한 비밀번호는 지우고 아이디와 로그인 유지 선택은 재입력을 위해 보존한다.
      clearPassword(error instanceof AuthRequestError && error.code === "INVALID_CREDENTIALS");
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
        noValidate
        onSubmit={handleSubmit}
        onInput={() => setInvalidField(undefined)}
        aria-label="로그인"
        aria-busy={pending || !ready}
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
              aria-invalid={invalidField === "username"}
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
              aria-invalid={invalidField === "password"}
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
          {pending ? "로그인 중…" : retryRemaining ? `${retryRemaining}초 후 로그인` : "로그인"}
          <Icon name="arrow" />
        </button>

      </form>
      {ready && toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} duration={toast.duration}
        onDismiss={() => setToast(current => current?.id === toast.id ? undefined : current)} />}
      {serverError && <AuthNoticeDialog title="로그인 오류" message={serverError} ready={ready} retryAt={retryUntil} onClose={dismissServerError} />}
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
