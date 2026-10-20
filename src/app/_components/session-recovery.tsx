"use client";

import styles from "../home.module.css";

/** Server Component의 쿠키 쓰기를 피하고 브라우저의 보호된 POST 경계에서 복구한다. 자동 복구는 공유 세션 저장소에서 중복 없이 수행한다. */
export function SessionRecovery({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <section className={styles.card} aria-labelledby="recovery-title" aria-busy={!message}>
      <h1 id="recovery-title">로그인 상태 확인</h1>
      <p role="status">{message ?? "로그인 상태를 확인하고 있어요…"}</p>
      {message && (
        <button className={styles.button} type="button" onClick={onRetry}>다시 확인</button>
      )}
    </section>
  );
}
