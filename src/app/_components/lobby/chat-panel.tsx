"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { useChat } from "@/features/chat/client/chat-provider";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 홈 채팅은 한 채널만 사용한다. 두 반응형 패널은 로비의 단일 WebSocket 상태를 공유한다. */
export function ChatPanel({
  active = true,
  onClose,
}: {
  active?: boolean;
  onClose?: () => void;
}) {
  const chat = useChat();
  const headingId = useId();
  const statusId = useId();
  const onlineId = useId();
  const [draft, setDraft] = useState("");
  const [composerError, setComposerError] = useState("");
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [lastActive, setLastActive] = useState(active);
  const [draftSession, setDraftSession] = useState(chat.sessionId);
  const [presenceSpinning, setPresenceSpinning] = useState(false);
  const [presenceSpinTick, setPresenceSpinTick] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onlineRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const preserveScroll = useRef<{ id: string; offset: number } | null>(null);
  const previousMessageCount = useRef(0);
  const connected = chat.state === "connected";
  const { loadPresence } = chat;
  const onlineLabel =
    chat.onlineCount === null
      ? "접속자 확인 중"
      : `${chat.onlineCount.toLocaleString("ko-KR")}명 접속 중`;

  useEffect(() => {
    if (onlineOpen && connected && active) loadPresence();
  }, [onlineOpen, connected, active, loadPresence]);

  useEffect(() => {
    if (!presenceSpinning) return;
    const timer = window.setTimeout(() => {
      if (!chat.onlineLoading) setPresenceSpinning(false);
    }, 680);
    return () => window.clearTimeout(timer);
  }, [presenceSpinning, presenceSpinTick, chat.onlineLoading]);

  useEffect(() => {
    if (!onlineOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !onlineRef.current?.contains(event.target)
      )
        setOnlineOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOnlineOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [onlineOpen]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!active || !body) return;
    if (preserveScroll.current !== null) {
      // 500개 창에서 뒤쪽을 제거하면 전체 높이가 같아질 수 있으므로 보이던 메시지의 위치를 기준으로 보정한다.
      const anchor = preserveScroll.current;
      const message = body.querySelector<HTMLElement>(`[data-chat-message-id="${anchor.id}"]`);
      if (message) body.scrollTop += message.getBoundingClientRect().top - body.getBoundingClientRect().top - anchor.offset;
      if (chat.history !== "loading") preserveScroll.current = null;
    } else if (nearBottom.current || previousMessageCount.current === 0) {
      body.scrollTop = body.scrollHeight;
    }
    previousMessageCount.current = chat.messages.length;
  }, [chat.messages, chat.pending, chat.history, active]);

  // 이미 열려 있는 접속자 팝업은 패널을 닫을 때 함께 닫는다. Effect의 추가 렌더 대신 prop 전환에 맞춰 조정한다.
  if (lastActive !== active) {
    setLastActive(active);
    if (!active) setOnlineOpen(false);
  }
  // 다른 계정으로 전환됐을 때 이전 사용자의 작성 중 본문과 팝업 상태를 새 로그인에 남기지 않는다.
  if (chat.sessionId && draftSession !== chat.sessionId) {
    setDraftSession(chat.sessionId);
    setDraft("");
    setComposerError("");
    setOnlineOpen(false);
  }

  function loadEarlier() {
    const body = bodyRef.current;
    if (body) {
      const top = body.getBoundingClientRect().top;
      const message = [...body.querySelectorAll<HTMLElement>("[data-chat-message-id]")]
        .find((element) => element.getBoundingClientRect().bottom > top);
      if (message?.dataset.chatMessageId) {
        preserveScroll.current = { id: message.dataset.chatMessageId, offset: message.getBoundingClientRect().top - top };
      }
    }
    if (!chat.loadOlder()) preserveScroll.current = null;
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = chat.sendMessage(draft);
    if (!result.ok) {
      setComposerError(result.message ?? "메시지를 전송하지 못했습니다.");
      return;
    }
    setComposerError("");
    setDraft("");
    nearBottom.current = true;
  }

  const status = {
    login: "로그인 후 채팅을 이용할 수 있어요.",
    connecting: "채팅 서버에 연결하고 있어요.",
    connected: "메시지는 저장된 뒤 모두에게 전달돼요.",
    reconnecting: "연결이 끊겨 다시 접속하고 있어요.",
    expired: "로그인 상태를 다시 확인하고 있어요.",
  }[chat.state];

  return (
    <section className={styles.chatPanel} aria-labelledby={headingId}>
      <div className={styles.chatHeader}>
        <h2 id={headingId}>
          <LobbyIcon name="chat" />
          실시간 채팅
        </h2>
        <div className={styles.chatHeaderActions}>
          <div className={styles.presenceAnchor} ref={onlineRef}>
            <button
              type="button"
              className={styles.onlineCountButton}
              aria-label={`현재 ${onlineLabel}, 접속자 목록 보기`}
              aria-expanded={onlineOpen}
              aria-controls={onlineId}
              onClick={() => setOnlineOpen((value) => !value)}
              disabled={!connected}
            >
              <LobbyIcon name="users" />
              {onlineLabel}
            </button>
            {onlineOpen && (
              <div
                className={styles.onlinePopover}
                id={onlineId}
                role="dialog"
                aria-label="현재 접속자 목록"
              >
                <div className={styles.onlinePopoverHeader}>
                  <strong>현재 접속자</strong>
                  <button
                    type="button"
                    className={`${styles.onlineRefresh} ${presenceSpinning ? styles.onlineRefreshSpin : ""}`}
                    aria-label="접속자 목록 새로고침"
                    aria-busy={presenceSpinning}
                    onClick={() => {
                      chat.loadPresence();
                      setPresenceSpinning(true);
                      setPresenceSpinTick((value) => value + 1);
                    }}
                  >
                    <LobbyIcon name="refresh" />
                  </button>
                </div>
                <ul className={styles.onlineList}>
                  {chat.onlineUsers.map((user, index) => (
                    <li key={`${index}-${user.nickname}`}>
                      <span className={styles.onlineAvatar}>
                        <ProfileAvatar avatarId={user.avatarId} size={28} />
                      </span>
                      <span>{user.nickname}</span>
                    </li>
                  ))}
                </ul>
                {chat.onlineUsers.length === 0 && (
                  <p className={styles.onlineEmpty}>
                    {chat.onlineLoading
                      ? "목록을 불러오고 있어요…"
                      : "표시할 접속자가 없어요."}
                  </p>
                )}
                {chat.onlineNextCursor !== null && (
                  <div className={styles.onlineActions}>
                    <button
                      type="button"
                      disabled={chat.onlineLoading}
                      onClick={() =>
                        chat.loadPresence(chat.onlineNextCursor)
                      }
                    >
                      더 보기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {onClose && (
            <button
              className={styles.iconButton}
              type="button"
              onClick={onClose}
              aria-label="채팅 닫기"
            >
              <LobbyIcon name="close" />
            </button>
          )}
        </div>
      </div>
      <div className={styles.channelRow}>
        {/* 홈은 GLOBAL 하나뿐이므로 채널 선택기는 두지 않는다. */}
        <span
          className={`${styles.connectionStatus} ${connected ? styles.connectionOnline : ""}`}
        >
          <span aria-hidden="true" />
          {connected ? "실시간 연결됨" : status}
        </span>
      </div>
      <div
        className={styles.chatBody}
        ref={bodyRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            90;
        }}
        aria-label="전체 채팅 메시지"
        role="log"
        aria-live="off"
      >
        {chat.history === "more" && (
          <button
            type="button"
            className={styles.chatLoadMore}
            onClick={loadEarlier}
          >
            이전 대화 보기
          </button>
        )}
        {chat.history === "loading" && (
          <p className={styles.chatFeedback}>이전 대화를 불러오는 중…</p>
        )}
        {chat.history === "error" && (
          <button
            type="button"
            className={styles.chatLoadMore}
            onClick={chat.retryHistory}
          >
            대화 다시 불러오기
          </button>
        )}
        {/* 과거 탐색 중에는 메시지 창을 보존하고 사용자가 원할 때 최신 대화로 복귀한다. */}
        {chat.viewingOlder && <button type="button" className={styles.chatLoadMore} disabled={chat.history === "loading"}
          onClick={() => { preserveScroll.current = null; nearBottom.current = true; chat.returnToLatest(); }}>
          {chat.hasNewMessages ? "새 대화가 있어요 · 최신 대화 보기" : "최신 대화 보기"}
        </button>}
        <div className={styles.welcomeMessage}>
          <span className={styles.systemAvatar}>
            <LobbyIcon name="gamepad" />
          </span>
          <div>
            <span className={styles.systemName}>
              Playground <span>안내</span>
            </span>
            <p>
              플레이그라운드에 오신 걸 환영해요!{" "}
              <span aria-hidden="true">👋</span>
              <br />
              모두가 함께 이야기하는 공간이에요.
            </p>
          </div>
        </div>
        {chat.messages.length === 0 && chat.pending.length === 0 && (
          <div className={styles.chatEmpty}>
            <div className={styles.chatIllustration}>
              <LobbyIcon name="chat" />
              <span>✦</span>
              <i>✧</i>
            </div>
            <h3>첫 대화를 기다리고 있어요</h3>
            <p>{connected ? "반가운 인사로 대화를 시작해 보세요." : status}</p>
          </div>
        )}
        <ul className={styles.chatMessageList}>
          {chat.messages.map((message) => (
            <li
              key={message.id}
              data-chat-message-id={message.id}
              className={`${styles.chatMessage} ${message.ownMessage ? styles.myChatMessage : ""}`}
            >
              {!message.ownMessage && (
                <span className={styles.chatMessageAvatar}>
                  <ProfileAvatar avatarId={message.avatarId} size={32} />
                </span>
              )}
              <div className={styles.chatMessageContent}>
                <span className={styles.chatMessageMeta}>
                  <strong>
                    {message.ownMessage ? "나" : message.nickname}
                  </strong>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
                <p>{message.content}</p>
              </div>
            </li>
          ))}
          {chat.pending.map((pending) => (
            <li
              className={`${styles.chatMessage} ${styles.myChatMessage}`}
              key={pending.clientMessageId}
            >
              <div className={styles.chatMessageContent}>
                <span className={styles.chatMessageMeta}>
                  <strong>나</strong>
                  <span>
                    {pending.state === "queued"
                      ? "저장 확인 중"
                      : "전송 상태 확인 필요"}
                  </span>
                </span>
                <p>{pending.content}</p>
                {/* 본문과 요청 식별자는 유지하고 서버 저장 여부를 먼저 확인한 뒤 재전송한다. */}
                {pending.state !== "queued" && <button type="button" className={styles.chatRetry}
                  disabled={!connected} onClick={() => chat.retryMessage(pending.clientMessageId)}>전송 확인 후 다시 보내기</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.chatFooter}>
        <p id={statusId} role="status">
          {composerError || status}
        </p>
        {/* 채팅 입력은 아이콘·전송 버튼을 감싼 테두리 하나만 강조한다. */}
        <form
          data-focus-frame
          className={styles.chatComposer}
          aria-describedby={statusId}
          onSubmit={send}
        >
          <LobbyIcon name="smile" />
          <input
            aria-label="채팅 메시지"
            placeholder={
              connected ? "메시지를 입력하세요…" : "연결 후 입력할 수 있어요"
            }
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (composerError) setComposerError("");
            }}
            maxLength={1000}
            autoComplete="off"
            disabled={!connected}
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            aria-label="메시지 전송"
          >
            <LobbyIcon name="send" />
          </button>
        </form>
        {chat.state === "reconnecting" && (
          <button
            type="button"
            className={styles.chatRetry}
            onClick={chat.retry}
          >
            다시 연결
          </button>
        )}
      </div>
    </section>
  );
}
