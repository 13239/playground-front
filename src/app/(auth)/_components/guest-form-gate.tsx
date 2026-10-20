"use client";

import { useEffect, type ReactNode } from "react";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import styles from "../auth.module.css";

/** 브라우저 키·최신 Redis 검증 후 로그인된 사용자는 홈으로 보낸다. 오래된 쿠키나 쿠키 존재만으로 이동하지 않는다. */
export function GuestFormGate({ children }: { children: (ready: boolean) => ReactNode }) {
  const state = useAuthSession();
  useEffect(() => {
    if (state.status === "authenticated") window.location.replace("/");
  }, [state.status]);

  return (
    <>
      {state.status !== "anonymous" && (
        <div aria-busy={state.status === "checking"}>
          <p role="status" className={styles.formStatus}>{state.status === "error" ? state.message : "로그인 상태를 확인하고 있어요…"}</p>
          {state.status === "error" && <button type="button" className={styles.submitButton} onClick={revalidateAuthSession}>다시 확인</button>}
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
