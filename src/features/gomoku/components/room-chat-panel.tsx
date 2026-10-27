"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { SocialProfileButton } from "@/features/social/social-profile-button";
import { useChatConnection } from "@/features/chat/client/use-global-chat";
import { RetryButton } from "@/app/_components/retry-button";
import type { WaitingRoom } from "../waiting-contracts";
import styles from "./waiting-room.module.css";

const time = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** 방별 독립 연결로 실제 저장·전파 메시지만 표시하고 서버에서 확인한 참가·준비 변화만 안내한다. */
export function RoomChatPanel({ room }: { room: WaitingRoom }) {
  const chat = useChatConnection({
    scope: "GAME_ROOM",
    gameType: "GOMOKU",
    roomId: room.id,
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [observed, setObserved] = useState(room);
  const [events, setEvents] = useState<
    Readonly<{ id: string; text: string }>[]
  >([]);
  const body = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const scrollAnchor = useRef<number | null>(null);
  const connected = chat.state === "connected";

  // 폴링에서 확인한 실제 변화만 로컬 안내로 추가한다. 새로고침으로 과거 입장 알림을 만들어내지 않는다.
  if (observed.revision !== room.revision) {
    const changes: { id: string; text: string }[] = [];
    for (const member of room.participants) {
      const previous = observed.participants.find(
        (p) => p.seat === member.seat && p.nickname === member.nickname,
      );
      if (!previous)
        changes.push({
          id: `${room.revision}:${member.seat}:join`,
          text: `${member.nickname}님이 입장했어요.`,
        });
      else if (member.ready !== previous.ready)
        changes.push({
          id: `${room.revision}:${member.seat}:ready`,
          text: `${member.nickname}님이 ${member.ready ? "준비를 마쳤어요." : "준비를 취소했어요."}`,
        });
    }
    for (const previous of observed.participants) {
      if (
        !room.participants.some(
          (p) => p.seat === previous.seat && p.nickname === previous.nickname,
        )
      ) {
        changes.push({
          id: `${room.revision}:${previous.seat}:leave`,
          text: `${previous.nickname}님이 나갔어요.`,
        });
      }
    }
    setObserved(room);
    if (changes.length)
      setEvents((current) => [...current, ...changes].slice(-20));
  }

  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    if (scrollAnchor.current !== null) {
      element.scrollTop = element.scrollHeight - scrollAnchor.current;
      if (chat.history !== "loading") scrollAnchor.current = null;
    } else if (nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [chat.messages, chat.pending, chat.history, events]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = chat.sendMessage(draft);
    if (!result.ok) {
      setError(result.message ?? "메시지를 보내지 못했습니다.");
      return;
    }
    setDraft("");
    setError("");
    setEmojiOpen(false);
    nearBottom.current = true;
  }
  const status = {
    login: "로그인 후 이용해 주세요.",
    connecting: "방 채팅에 연결하고 있어요.",
    connected: "이 방의 참가자만 대화를 볼 수 있어요.",
    reconnecting: "연결을 복구하고 있어요.",
    expired: chat.error ?? "로그인 상태를 다시 확인해 주세요.",
    error: chat.error ?? "방 채팅에 연결하지 못했어요. 잠시 후 다시 연결해 주세요.",
  }[chat.state];

  return (
    <aside className={styles.roomChat} aria-label="방 채팅">
      <div className={styles.chatHeader}>
        <h2>
          <LobbyIcon name="chat" />{room.game ? "실시간 채팅" : "방 채팅"}
        </h2>
        <span
          className={styles.connectionDot}
          data-connected={connected}
          aria-label={connected ? "연결됨" : "연결 중"}
        />
        <span
          className={styles.chatCount}
          aria-label={`참가자 ${room.participants.length}명`}
        >
          <LobbyIcon name="users" />
          {room.participants.length}
        </span>
      </div>
      <div
        className={styles.chatBody}
        ref={body}
        onScroll={() => {
          if (body.current)
            nearBottom.current =
              body.current.scrollHeight -
                body.current.scrollTop -
                body.current.clientHeight <
              80;
        }}
      >
        <div className={styles.systemNotice}>
          <strong>
            Playground <small>시스템</small>
          </strong>
          <p>{room.game ? "서로를 존중하며 즐겁게 대국해요." : "준비하는 동안 이야기를 나눠보세요."}</p>
        </div>
        {events.map((event) => (
          <div className={styles.systemNotice} key={event.id}>
            <strong>
              Playground <small>시스템</small>
            </strong>
            <p>{event.text}</p>
          </div>
        ))}
        {(chat.history === "more" || chat.history === "error") && (
          <button
            type="button"
            className={styles.chatTextButton}
            disabled={!connected}
            onClick={() => {
              const el = body.current;
              if (el) scrollAnchor.current = el.scrollHeight - el.scrollTop;
              if (
                !(chat.history === "error"
                  ? chat.retryHistory()
                  : chat.loadOlder())
              )
                scrollAnchor.current = null;
            }}
          >
            이전 대화 {chat.history === "error" ? "다시 불러오기" : "보기"}
          </button>
        )}
        {chat.history === "loading" && (
          <p className={styles.chatStatus}>대화를 불러오고 있어요.</p>
        )}
        <ul className={styles.messages} aria-label="방 채팅 메시지">
          {chat.messages.map((message) => (
            <li
              key={message.id}
              className={styles.message}
              data-own={message.ownMessage}
            >
              {/* 홈 채팅처럼 서버에서 본인으로 확인한 메시지는 아바타를 생략하고 이름을 '나'로 표시한다. */}
              {!message.ownMessage && <SocialProfileButton publicId={message.publicUserId} nickname={message.nickname}><ProfileAvatar avatarId={message.avatarId} size={44} /></SocialProfileButton>}
              <div>
                <div className={styles.messageMeta}>
                  <strong>{message.ownMessage ? "나" : message.nickname}</strong>
                  <time dateTime={message.createdAt}>
                    {time.format(new Date(message.createdAt))}
                  </time>
                </div>
                <p>{message.content}</p>
              </div>
            </li>
          ))}
          {chat.pending.map((message) => (
            <li
              key={message.clientMessageId}
              className={`${styles.message} ${styles.pendingMessage}`}
              data-own="true"
            >
              <div>
                <div className={styles.messageMeta}>
                  <strong>나</strong>
                  <small>
                    {message.state === "queued"
                      ? "보내는 중"
                      : message.state === "failed"
                        ? "전송 확인 필요"
                        : "확인 중"}
                  </small>
                </div>
                <p>{message.content}</p>
                {message.state !== "queued" && (
                  <button
                    className={styles.chatTextButton}
                    disabled={!connected}
                    onClick={() => chat.retryMessage(message.clientMessageId)}
                  >
                    전송 확인 후 다시 보내기
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {chat.hasNewMessages && (
          <button
            className={styles.chatTextButton}
            onClick={() => {
              nearBottom.current = true;
              chat.returnToLatest();
            }}
          >
            최신 대화 보기
          </button>
        )}
      </div>
      <div className={styles.chatFooter}>
        <p className={styles.chatStatus} role="status">
          {chat.state === "error" ? status : error || status}
        </p>
        {emojiOpen && (
          <div className={styles.emojiTray} aria-label="이모지 선택">
            {["😊", "👋", "🎮", "👍", "😆", "🍀", "✨", "❤️"].map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`${emoji} 추가`}
                onClick={() => {
                  setDraft((current) =>
                    [...current, ...emoji].slice(0, 1000).join(""),
                  );
                  setEmojiOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {/* 대기실·대국·팝업에서 같은 채팅 프레임의 1px 테두리를 공유한다. */}
        <form data-focus-frame className={styles.composer} onSubmit={send}>
          <button
            type="button"
            aria-label="이모지 선택"
            aria-expanded={emojiOpen}
            disabled={!connected}
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <LobbyIcon name="smile" />
          </button>
          <input
            aria-label="방 채팅 메시지"
            placeholder={
              connected ? "메시지를 입력하세요" : "연결 후 입력할 수 있어요"
            }
            value={draft}
            maxLength={1000}
            autoComplete="off"
            disabled={!connected}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
          />
          <button
            className={styles.sendButton}
            type="submit"
            aria-label="메시지 전송"
            disabled={!connected || !draft.trim()}
          >
            <LobbyIcon name="send" />
          </button>
        </form>
        {/* 방 참가·채팅 인증 오류는 방 채팅의 재시도로 복구하며 입력은 재연결 전까지 비활성화한다. */}
        {(chat.state === "reconnecting" || chat.state === "error") && (
          <RetryButton className={styles.chatTextButton} label="다시 연결" onRetry={chat.retry} retryAt={chat.retryAt} />
        )}
      </div>
    </aside>
  );
}
