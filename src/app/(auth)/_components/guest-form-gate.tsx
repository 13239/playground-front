"use client";

import { useEffect, type ReactNode } from "react";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { RetryButton } from "@/app/_components/retry-button";
import { useRetryCountdown } from "@/lib/client/use-retry-countdown";
import styles from "../auth.module.css";

/** 브라우저 키·최신 Redis 검증 후 로그인된 사용자는 홈으로 보낸다. 오래된 쿠키나 쿠키 존재만으로 이동하지 않는다. */
export function GuestFormGate({ children }: { children: (ready: boolean) => ReactNode }) {
  const state = useAuthSession();
  // 로그인·가입 폼도 공통 세션의 지연·제한 대기를 표시하며 입력값은 기존 DOM 안에 유지한다.
  const seconds = useRetryCountdown(state.status === "checking"
    ? state.retryAt ?? (state.startedAt === undefined ? undefined : state.startedAt + 5000) : undefined);
  const waiting = state.status === "checking" && state.retryAt !== undefined && seconds > 0;
  const checkingMessage = waiting ? `${seconds}초 후 로그인 상태를 다시 확인할게요.`
    : state.status === "checking" && state.startedAt !== undefined && seconds === 0
      ? "로그인 확인이 지연되고 있어요. 잠시만 기다려 주세요." : "로그인 상태를 확인하고 있어요…";
  useEffect(() => {
    if (state.status === "authenticated") window.location.replace("/");
  }, [state.status]);

  return (
    <>
      {/* 긴 운영 안내도 기존 반응형 문구 스타일로 표시하며 HTML로 해석하지 않는다. */}
      {state.status === "anonymous" && state.message && <p role="status" className={styles.formStatus}>{state.message}</p>}
      {state.status !== "anonymous" && (
        <div aria-busy={state.status === "checking" || state.status === "error" && state.pending}>
          <p role={waiting ? undefined : "status"} className={styles.formStatus}>{state.status === "error" ? state.message : checkingMessage}</p>
          {state.status === "error" && <RetryButton className={styles.submitButton} label="다시 확인" onRetry={revalidateAuthSession} retryAt={state.retryAt} pending={state.pending} />}
        </div>
      )}
      {/* 탭을 오가며 확인하는 동안에도 폼은 유지해 닉네임·아이디·유지 선택·입력 중인 비밀번호를 지우지 않는다. */}
      <div hidden={state.status !== "anonymous"}>
        {children(state.status === "anonymous")}
      </div>
      {/* 초기 폼이 숨겨져 있어도 JavaScript가 없는 환경에는 이용 조건을 표시한다. */}
      <noscript><p className={styles.noScript}>계정 화면을 이용하려면 브라우저에서 JavaScript를 켜 주세요.</p></noscript>
    </>
  );
}
