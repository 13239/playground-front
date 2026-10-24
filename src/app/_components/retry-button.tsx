"use client";

import { useRetryCountdown } from "@/lib/client/use-retry-countdown";

/** 대기 중인 재시도를 눌러도 반응이 없는 상태를 피하고, 현재 요청과 서버의 제한을 화면에서도 지킨다. */
export function RetryButton({ label, onRetry, retryAt, pending = false, className }: {
  label: string; onRetry: () => void; retryAt?: number; pending?: boolean; className?: string;
}) {
  const seconds = useRetryCountdown(retryAt);
  return (
    <button type="button" className={className} disabled={pending || seconds > 0} aria-busy={pending || undefined} aria-live="off"
      onClick={() => { if (!pending && seconds === 0) onRetry(); }}>
      {pending ? "확인 중…" : seconds > 0 ? `${seconds}초 후 ${label}` : label}
    </button>
  );
}
