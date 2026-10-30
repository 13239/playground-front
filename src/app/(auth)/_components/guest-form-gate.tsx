"use client";

import { useEffect, useState, type ReactNode } from "react";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { RetryButton } from "@/app/_components/retry-button";
import { useRetryCountdown } from "@/lib/client/use-retry-countdown";
import styles from "../auth.module.css";
import { Toast } from "@/components/ui/toast";
import { AuthNoticeDialog } from "./auth-notice-dialog";

function SessionError({ message, retryAt, pending }: { message: string; retryAt?: number; pending?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  return <>
    <RetryButton className={styles.submitButton} label="다시 확인" onRetry={revalidateAuthSession} retryAt={retryAt} pending={pending} />
    {!dismissed && !pending && <AuthNoticeDialog title="로그인 상태 확인 오류" message={message} retryAt={retryAt} onClose={() => setDismissed(true)} />}
  </>;
}

function AccessNotice({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  return !dismissed && <AuthNoticeDialog title="로그인 제한" message={message} onClose={() => setDismissed(true)} />;
}

/** 브라우저 키·최신 Redis 검증 후 로그인된 사용자는 홈으로 보낸다. 오래된 쿠키나 쿠키 존재만으로 이동하지 않는다. */
export function GuestFormGate({ children, showAccessNotice = true }: { children: (ready: boolean) => ReactNode; showAccessNotice?: boolean }) {
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
      {/* 상태 확인 안내도 폼 본문 대신 토스트·확인창으로 표시한다. */}
      {showAccessNotice && state.status === "anonymous" && state.message && <AccessNotice key={state.message} message={state.message} />}
      {state.status === "checking" && <Toast message={checkingMessage} duration={null} delay={350} />}
      {state.status === "error" && <SessionError key={`${state.message}:${state.retryAt ?? 0}`} message={state.message} retryAt={state.retryAt} pending={state.pending} />}
      {/* 탭을 오가며 확인하는 동안에도 폼은 유지해 닉네임·아이디·유지 선택·입력 중인 비밀번호를 지우지 않는다. */}
      <div hidden={state.status !== "anonymous"}>
        {children(state.status === "anonymous")}
      </div>
      {/* 스크립트가 없어도 HTML 기본 확인창과 닫기 동작으로 이용 조건을 안내한다. */}
      <noscript><dialog open className={styles.dialog} role="alertdialog" aria-label="JavaScript 설정 안내">
        <h2>JavaScript 설정 안내</h2><p>계정 화면을 이용하려면 브라우저에서 JavaScript를 켜 주세요.</p>
        <form method="dialog"><button type="submit" className={styles.dialogClose}>확인</button></form>
      </dialog></noscript>
    </>
  );
}
