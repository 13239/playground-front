import { Suspense } from "react";
import { SessionContent } from "./_components/session-content";
import styles from "./home.module.css";

export default function Home() {
  // Cache Components에서는 요청별 인증 정보를 정적 셸에 넣지 않고 경계 안에서 읽는다.
  return (
    <main className={styles.screen}>
      <Suspense fallback={<p role="status">로그인 상태를 확인하고 있어요…</p>}>
        <SessionContent />
      </Suspense>
    </main>
  );
}
