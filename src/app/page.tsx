import { Suspense } from "react";
import { SessionContent } from "./_components/session-content";
import styles from "./home.module.css";

export default function Home() {
  // 서버 화면 틀에는 인증 정보를 넣지 않는다. 경계 안의 브라우저가 키를 증명한 뒤 사용자 정보를 읽는다.
  return (
    <main className={styles.screen}>
      <Suspense fallback={<p role="status">로그인 상태를 확인하고 있어요…</p>}>
        <SessionContent />
      </Suspense>
    </main>
  );
}
