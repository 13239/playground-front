"use client";

import styles from "../home.module.css";
import { RetryButton } from "./retry-button";
import { useRetryCountdown } from "@/lib/client/use-retry-countdown";

/** Server Component의 쿠키 쓰기를 피하고 브라우저의 보호된 POST 경계에서 복구한다. 자동 복구는 공유 세션 저장소에서 중복 없이 수행한다. */
export function SessionRecovery({
  message,
  onRetry,
  compact = false,
  retryAt,
  pending = false,
  startedAt,
}: {
  message?: string;
  onRetry: () => void;
  compact?: boolean;
  retryAt?: number;
  pending?: boolean;
  startedAt?: number;
}) {
  const seconds = useRetryCountdown(retryAt ?? (startedAt === undefined ? undefined : startedAt + 5000));
  const waiting = Boolean(retryAt && seconds > 0);
  const checkingMessage = waiting ? `${seconds}초 후 로그인 확인` : startedAt !== undefined && seconds === 0
    ? "로그인 확인이 지연되고 있어요. 잠시만 기다려 주세요." : "로그인 확인 중…";
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
          <RetryButton className={styles.button} label="다시 확인" onRetry={onRetry} retryAt={retryAt} pending={pending} />
        </div>
      </details>
    ) : (
      <p className={styles.checkingSession} role={waiting ? undefined : "status"}>
        {waiting ? checkingMessage : startedAt !== undefined && seconds === 0 ? "로그인 확인 지연" : "로그인 확인 중…"}
      </p>
    );
  return (
    <section
      className={styles.card}
      aria-labelledby="recovery-title"
      aria-busy={pending || !message}
    >
      <h1 id="recovery-title">로그인 상태 확인</h1>
      <p role={waiting ? undefined : "status"}>{message ?? checkingMessage}</p>
      {message && (
        <RetryButton className={styles.button} label="다시 확인" onRetry={onRetry} retryAt={retryAt} pending={pending} />
      )}
    </section>
  );
}
