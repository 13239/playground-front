"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequestError, getSession, refreshSession } from "@/features/auth/client/api";
import styles from "../home.module.css";

/** Server Component의 쿠키 쓰기를 피하고 브라우저의 보호된 POST 경계에서 로그인 상태를 복구한다. */
export function SessionRecovery() {
  const router = useRouter();
  const [state, setState] = useState({ pending: true, message: "로그인 상태를 확인하고 있어요…" });

  useEffect(() => {
    let active = true;
    // 자동 복구는 마운트당 한 번만 시도한다. 인증 실패·장애 시 무한 갱신하지 않는다.
    void (async () => {
      try {
        await refreshSession();
        if (!active) return;
        await getSession(false);
        if (active) {
          setState({ pending: false, message: "로그인 상태를 다시 확인합니다." });
          router.refresh();
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof AuthRequestError && error.status === 401) {
          window.location.replace("/login");
          return;
        }
        setState({ pending: false, message: error instanceof AuthRequestError
          ? error.message : "로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요." });
      }
    })();
    return () => { active = false; };
  }, [router]);

  return (
    <section className={styles.card} aria-labelledby="recovery-title" aria-busy={state.pending}>
      <h1 id="recovery-title">로그인 상태 확인</h1>
      <p role="status">{state.message}</p>
      {!state.pending && (
        <form action="/" method="get"><button className={styles.button} type="submit">다시 확인</button></form>
      )}
    </section>
  );
}
