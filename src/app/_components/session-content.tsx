"use client";

import { useEffect, useRef, useState } from "react";
import { AuthRequestError, reportActivity } from "@/features/auth/client/api";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { LogoutButton } from "./logout-button";
import { SessionRecovery } from "./session-recovery";
import styles from "../home.module.css";

/** 화면을 표시할 때마다 브라우저 키와 최신 Redis 세션을 확인하며 사용자 테이블은 조회하지 않는다. */
export function SessionContent() {
  // 자동 복구는 마운트/명시적 재시도와 탭 변경 때 한 번씩 수행한다. 쿠키만으로 SSR/RSC에 사용자 정보를 노출하지 않는다.
  const state = useAuthSession();
  const session = state.status === "authenticated" ? state.session : undefined;
  const [activityError, setActivityError] = useState<{ sessionId: string; message: string }>();
  const activityTiming = useRef({ sessionId: "", nextAllowedAt: 0 });
  useEffect(() => {
    if (state.status === "anonymous") window.location.replace("/login");
  }, [state.status]);

  useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId) return;
    if (activityTiming.current.sessionId !== sessionId) activityTiming.current = { sessionId, nextAllowedAt: 0 };
    let pending = false;
    let active = true;
    // 실제 사용자 입력이 있는 보이는 탭에서만 최대 분당 한 번 연장한다. 폴링/토큰 갱신은 활동이 아니다.
    const onActivity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible" || pending || performance.now() < activityTiming.current.nextAllowedAt) return;
      activityTiming.current.nextAllowedAt = performance.now() + 60_000;
      pending = true;
      void reportActivity(sessionId).then(() => {
        if (active) setActivityError(undefined);
      }).catch(error => {
        if (!active) return;
        if (error instanceof AuthRequestError && error.status === 401) { window.location.replace("/login"); return; }
        if (error instanceof AuthRequestError && error.code === "LOGIN_SESSION_CHANGED") { revalidateAuthSession(); return; }
        // 일시적인 장애 후에는 다음 실제 입력에서 재시도하되 빠른 연속 실패 요청은 막는다.
        activityTiming.current.nextAllowedAt = performance.now() + 5000;
        setActivityError({ sessionId, message: error instanceof AuthRequestError ? error.message : "로그인 유지 상태를 확인하지 못했습니다." });
      }).finally(() => { pending = false; });
    };
    // 스크립트의 자동 스크롤도 발생시키는 scroll 이벤트 대신 실제 포인터·키·휠·터치 입력을 사용한다.
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchmove"];
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    return () => { active = false; for (const event of events) window.removeEventListener(event, onActivity); };
  }, [session?.sessionId]);

  if (!session) return <SessionRecovery message={state.status === "error" ? state.message : undefined} onRetry={revalidateAuthSession} />;

  return (
    <section className={styles.card} aria-labelledby="session-title">
      <p className={styles.brand}>Playground</p>
      <h1 id="session-title">{session.username}님, 반가워요.</h1>
      <p>로그인되었습니다.</p>
      {activityError?.sessionId === session.sessionId && <p role="status">{activityError.message}</p>}
      <LogoutButton sessionId={session.sessionId} />
    </section>
  );
}
