import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/server/session";
import { ApiError } from "@/lib/server/api-error";
import type { CurrentSession } from "@/features/auth/types";
import { LogoutButton } from "./logout-button";
import { SessionRecovery } from "./session-recovery";
import styles from "../home.module.css";

/** 화면을 표시할 때마다 최신 Redis 세션을 확인하며 사용자 테이블은 조회하지 않는다. */
export async function SessionContent() {
  let session: CurrentSession | null;
  try {
    session = await getCurrentSession();
  } catch (error) {
    if (error instanceof ApiError && error.code === "SESSION_REFRESH_REQUIRED") {
      return <SessionRecovery />;
    }
    // 인증 서비스 장애를 로그인 만료로 처리하지 않고 쿠키를 보존한 채 재시도를 안내한다.
    if (!(error instanceof ApiError)) throw error;
    return (
      <section className={styles.card} aria-labelledby="session-title">
        <h1 id="session-title">로그인 상태를 확인할 수 없어요</h1>
        <p role="status">{error.message}</p>
        <form action="/" method="get">
          <button className={styles.button} type="submit">다시 확인</button>
        </form>
      </section>
    );
  }
  if (!session) redirect("/login");

  return (
    <section className={styles.card} aria-labelledby="session-title">
      <p className={styles.brand}>Playground</p>
      <h1 id="session-title">{session.username}님, 반가워요.</h1>
      <p>로그인되었습니다.</p>
      <LogoutButton />
    </section>
  );
}
