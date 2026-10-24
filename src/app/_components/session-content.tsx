"use client";

import { useEffect, useRef, useState } from "react";
import { AuthRequestError, reportActivity } from "@/features/auth/client/api";
import { retryAuthSession, revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { authRetryDelay } from "@/features/auth/client/request-cooldown";
import { LogoutButton } from "./logout-button";
import { SessionRecovery } from "./session-recovery";
import { AccountMenu } from "./lobby/account-menu";

/** 최초 표시와 인증 변경은 브라우저 키·최신 Redis로 확인하고 일반 복귀는 화면을 유지하며 재확인한다. 사용자 테이블은 조회하지 않는다. */
export function SessionContent() {
  // 자동 복구는 공유 저장소가 중복·제한 대기를 관리한다. 쿠키만으로 SSR/RSC에 사용자 정보를 노출하지 않는다.
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
        if (error instanceof AuthRequestError && (error.status === 403 || error.code === "LOGIN_SESSION_CHANGED")) { revalidateAuthSession(); return; }
        // 일시적인 장애 후에는 다음 실제 입력에서 재시도하되 빠른 연속 실패 요청과 429 대기 중 재요청은 막는다.
        activityTiming.current.nextAllowedAt = performance.now() + authRetryDelay(error);
        setActivityError({ sessionId, message: error instanceof AuthRequestError ? error.message : "로그인 유지 상태를 확인하지 못했습니다." });
      }).finally(() => { pending = false; });
    };
    // 스크립트의 자동 스크롤도 발생시키는 scroll 이벤트 대신 실제 포인터·키·휠·터치 입력을 사용한다.
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchmove"];
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    return () => { active = false; for (const event of events) window.removeEventListener(event, onActivity); };
  }, [session?.sessionId]);

  // 로비의 공개 화면 틀은 유지하며 헤더의 계정 영역에서만 확인·복구 상태를 안내한다.
  // 표시 이름은 계정 메뉴가 조회한 닉네임을 사용하므로 로그인 아이디를 전달하지 않는다.
  if (!session) return <SessionRecovery compact message={state.status === "error" ? state.message : undefined} onRetry={retryAuthSession}
    retryAt={state.status === "error" || state.status === "checking" ? state.retryAt : undefined}
    pending={state.status === "error" && state.pending} startedAt={state.status === "checking" ? state.startedAt : undefined} />;

  return (
    <AccountMenu key={session.sessionId} sessionId={session.sessionId} sessionWarning={state.status === "authenticated" ? state.verificationError : undefined}>
      {/* 일시적인 재확인 지연은 화면 전체를 지우지 않고 계정 메뉴 안에서 알린다. */}
      {state.status === "authenticated" && state.verificationError && <p role="status">로그인 상태 확인이 지연되고 있어요. 잠시 후 자동으로 다시 확인할게요.</p>}
      {activityError?.sessionId === session.sessionId && <p role="status">{activityError.message}</p>}
      <LogoutButton sessionId={session.sessionId} />
    </AccountMenu>
  );
}
