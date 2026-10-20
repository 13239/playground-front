import { useId } from "react";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 서버 연결 전에는 실제 접속자·대화를 꾸미지 않고 채팅 영역의 빈 상태와 비활성 입력을 제공한다. */
export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const headingId = useId();
  const statusId = useId();
  return (
    <section className={styles.chatPanel} aria-labelledby={headingId}>
      <div className={styles.chatHeader}>
        <h2 id={headingId}>
          <LobbyIcon name="chat" />
          실시간 채팅
        </h2>
        {onClose ? (
          <button
            className={styles.iconButton}
            type="button"
            onClick={onClose}
            aria-label="채팅 닫기"
          >
            <LobbyIcon name="close" />
          </button>
        ) : (
          <span className={styles.previewBadge}>준비 중</span>
        )}
      </div>
      <div className={styles.channelRow}>
        <label className={styles.channelSelect}>
          <span className={styles.srOnly}>채팅 채널</span>
          <select defaultValue="all">
            <option value="all">전체 채널</option>
          </select>
          <LobbyIcon name="down" />
        </label>
        <span className={styles.connectionStatus}>
          <span />
          연결 준비 중
        </span>
      </div>
      <div className={styles.chatBody}>
        <p className={styles.chatDate}>우리의 즐거운 아지트</p>
        <div className={styles.welcomeMessage}>
          <span className={styles.systemAvatar}>
            <LobbyIcon name="gamepad" />
          </span>
          <div>
            <span className={styles.systemName}>
              Playground <span>안내</span>
            </span>
            <p>
              플레이그라운드에 오신 걸 환영해요!
              <br />
              함께할수록 더 즐거운 시간이 시작돼요.{" "}
              <span aria-hidden="true">👋</span>
            </p>
          </div>
        </div>
        <div className={styles.chatEmpty}>
          <div className={styles.chatIllustration}>
            <LobbyIcon name="chat" />
            <span>✦</span>
            <i>✧</i>
          </div>
          <h3>같이 놀고, 같이 이야기해요</h3>
          <p>
            게임 친구를 만나는 공간.
            <br />곧 이곳에서 이야기를 나눌 수 있어요.
          </p>
        </div>
        <div className={styles.chatGuideline}>
          <LobbyIcon name="smile" />
          <p>
            다정한 한마디가
            <br />더 즐거운 플레이그라운드를 만들어요.
          </p>
        </div>
      </div>
      <div className={styles.chatFooter}>
        <p id={statusId}>채팅 서비스를 준비하고 있어요</p>
        <div className={styles.chatComposer} aria-describedby={statusId}>
          <LobbyIcon name="smile" />
          <input
            aria-label="채팅 메시지"
            placeholder="메시지를 입력하세요..."
            disabled
          />
          <button type="button" disabled aria-label="메시지 전송">
            <LobbyIcon name="send" />
          </button>
        </div>
      </div>
    </section>
  );
}
