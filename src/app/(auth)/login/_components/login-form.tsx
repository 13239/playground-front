"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Icon } from "./icon";
import { NoticeButton } from "./notice-button";
import styles from "../login.module.css";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LoginForm() {
  // A disabled SSR submit button prevents an unintended native POST before
  // hydration (or with JavaScript off) while the screen has no auth endpoint.
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Publishing stage: no API contract exists yet. Do not transmit, persist,
    // log credentials or simulate successful authentication.
    setStatus("로그인 서비스를 준비하고 있어요. 잠시 후 다시 시도해 주세요.");
  }

  return (
    <form
      className={styles.form}
      method="post"
      onSubmit={handleSubmit}
      onInput={() => setStatus("")}
      aria-label="로그인"
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <Icon name="mail" className={styles.fieldIcon} />
          <label className={styles.srOnly} htmlFor="login-identifier">
            이메일 또는 아이디
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            placeholder="이메일 또는 아이디를 입력하세요"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
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
            name="rememberMe"
            type="checkbox"
            value="true"
            defaultChecked
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

      <button type="submit" className={styles.submitButton} disabled={!hydrated}>
        로그인
        <Icon name="arrow" />
      </button>

      <p role="status" aria-atomic="true" className={styles.formStatus}>
        {status}
      </p>
      <noscript>
        <p className={styles.noScript}>
          로그인 화면을 이용하려면 브라우저에서 JavaScript를 켜 주세요.
        </p>
      </noscript>
    </form>
  );
}
