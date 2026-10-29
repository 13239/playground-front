import { Icon } from "@/components/ui/icon";
import styles from "./lobby.module.css";

/** 오류를 확인한 사용자가 알림만 닫을 수 있다. 인증·연결 상태는 원래 흐름을 유지한다. */
export function ShootingNotice({
  message,
  dismiss,
  className = "",
}: {
  message: string;
  dismiss(): void;
  className?: string;
}) {
  return (
    <div className={`${styles.error} ${className}`} role="alert">
      <span>{message}</span>
      <button type="button" aria-label="알림 닫기" onClick={dismiss}>
        <Icon name="close" />
      </button>
    </div>
  );
}
