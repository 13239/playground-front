"use client";

import styles from "../home.module.css";

/** Server Component의 쿠키 쓰기를 피하고 브라우저의 보호된 POST 경계에서 복구한다. 자동 복구는 공유 세션 저장소에서 중복 없이 수행한다. */
export function SessionRecovery({
  message,
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  // 헤더에서는 팝오버로 오류·재시도를 제공해 긴 서버 안내가 탐색 메뉴의 너비를 밀어내지 않게 한다.
  if (compact)
    return message ? (
      <details className={styles.recoveryDetails}>
        <summary aria-label="로그인 확인 필요">
          <span className={styles.recoveryLabel}>로그인 확인 필요</span>
          <span className={styles.recoveryMark} aria-hidden="true">!</span>
        </summary>
        <div className={styles.recoveryPopover}>
          <p role="status">{message}</p>
          <button className={styles.button} type="button" onClick={onRetry}>
            다시 확인
          </button>
        </div>
      </details>
    ) : (
      <p className={styles.checkingSession} role="status">
        로그인 확인 중…
      </p>
    );
  return (
    <section
      className={styles.card}
      aria-labelledby="recovery-title"
      aria-busy={!message}
    >
      <h1 id="recovery-title">로그인 상태 확인</h1>
      <p role="status">{message ?? "로그인 상태를 확인하고 있어요…"}</p>
      {message && (
        <button className={styles.button} type="button" onClick={onRetry}>
          다시 확인
        </button>
      )}
    </section>
  );
}
