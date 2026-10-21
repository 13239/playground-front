"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { useChat } from "@/features/chat/client/chat-provider";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 홈 채팅은 한 채널만 사용한다. 두 반응형 패널은 로비의 단일 WebSocket 상태를 공유한다. */
export function ChatPanel({ active = true, onClose }: {
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const onlineRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const preserveScroll = useRef<number | null>(null);
  const previousMessageCount = useRef(0);
  const connected = chat.state === "connected";
  const onlineLabel = chat.onlineCount === null ? "접속자 확인 중" : `${chat.onlineCount.toLocaleString("ko-KR")}명 접속 중`;

  useEffect(() => {
    if (onlineOpen && connected && active) chat.loadPresence(0);
  }, [onlineOpen, connected, active, chat.loadPresence]);

  useEffect(() => {
    if (!onlineOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !onlineRef.current?.contains(event.target)) setOnlineOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOnlineOpen(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [onlineOpen]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!active || !body) return;
    if (preserveScroll.current !== null) {
      body.scrollTop += body.scrollHeight - preserveScroll.current;
      preserveScroll.current = chat.history === "loading" ? body.scrollHeight : null;
    } else if (nearBottom.current || previousMessageCount.current === 0) {
      body.scrollTop = body.scrollHeight;
    }
    previousMessageCount.current = chat.messages.length;
  }, [chat.messages, chat.pending, chat.history, active]);

  // 이미 열려 있는 접속자 팝업은 패널을 닫을 때 함께 닫는다.
  useEffect(() => { if (!active) setOnlineOpen(false); }, [active]);

  function loadEarlier() {
    const body = bodyRef.current;
    if (body) preserveScroll.current = body.scrollHeight;
    if (!chat.loadOlder()) preserveScroll.current = null;
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = chat.sendMessage(draft);
    if (!result.ok) { setComposerError(result.message ?? "메시지를 전송하지 못했습니다."); return; }
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
        <h2 id={headingId}><LobbyIcon name="chat" />실시간 채팅</h2>
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
              <div className={styles.onlinePopover} id={onlineId} role="dialog" aria-label="현재 접속자 목록">
                <div className={styles.onlinePopoverHeader}>
                  <strong>현재 접속자</strong>
                  <button type="button" className={styles.onlineClose} aria-label="접속자 목록 닫기" onClick={() => setOnlineOpen(false)}>
                    <LobbyIcon name="close" />
                  </button>
                </div>
                <p className={styles.onlineTotal}>{onlineLabel} · 같은 사람의 여러 탭은 1명으로 계산해요.</p>
                <ul className={styles.onlineList}>
                  {chat.onlineUsers.map((user, index) => (
                    <li key={`${index}-${user.nickname}`}>
                      <span className={styles.onlineAvatar}><ProfileAvatar avatarId={user.avatarId} size={28} /></span>
                      <span>{user.nickname}</span>
                    </li>
                  ))}
                </ul>
                {chat.onlineUsers.length === 0 && <p className={styles.onlineEmpty}>{chat.onlineLoading ? "목록을 불러오고 있어요…" : "표시할 접속자가 없어요."}</p>}
                <div className={styles.onlineActions}>
                  {chat.onlineNextOffset !== null && (
                    <button type="button" disabled={chat.onlineLoading} onClick={() => chat.loadPresence(chat.onlineNextOffset ?? 0)}>더 보기</button>
                  )}
                  <button type="button" disabled={chat.onlineLoading} onClick={() => chat.loadPresence(0)}>새로고침</button>
                </div>
              </div>
            )}
          </div>
          {onClose && (
            <button className={styles.iconButton} type="button" onClick={onClose} aria-label="채팅 닫기">
              <LobbyIcon name="close" />
            </button>
          )}
        </div>
      </div>
      <div className={styles.channelRow}>
        {/* 홈은 GLOBAL 하나뿐이므로 채널 선택기는 두지 않는다. */}
        <span className={`${styles.connectionStatus} ${connected ? styles.connectionOnline : ""}`}>
          <span aria-hidden="true" />{connected ? "실시간 연결됨" : status}
        </span>
      </div>
      <div
        className={styles.chatBody}
        ref={bodyRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
        }}
        aria-label="전체 채팅 메시지"
        role="log"
        aria-live="off"
      >
        {chat.history === "more" && (
          <button type="button" className={styles.chatLoadMore} onClick={loadEarlier}>이전 대화 보기</button>
        )}
        {chat.history === "loading" && <p className={styles.chatFeedback}>이전 대화를 불러오는 중…</p>}
        {chat.history === "error" && <button type="button" className={styles.chatLoadMore} onClick={() => chat.retry()}>대화 다시 불러오기</button>}
        <div className={styles.welcomeMessage}>
          <span className={styles.systemAvatar}><LobbyIcon name="gamepad" /></span>
          <div>
            <span className={styles.systemName}>Playground <span>안내</span></span>
            <p>플레이그라운드에 오신 걸 환영해요! <span aria-hidden="true">👋</span><br />모두가 함께 이야기하는 공간이에요.</p>
          </div>
        </div>
        {chat.messages.length === 0 && chat.pending.length === 0 && (
          <div className={styles.chatEmpty}>
            <div className={styles.chatIllustration}><LobbyIcon name="chat" /><span>✦</span><i>✧</i></div>
            <h3>첫 대화를 기다리고 있어요</h3>
            <p>{connected ? "반가운 인사로 대화를 시작해 보세요." : status}</p>
          </div>
        )}
        <ul className={styles.chatMessageList}>
          {chat.messages.map((message) => (
            <li key={message.id} className={`${styles.chatMessage} ${message.ownMessage ? styles.myChatMessage : ""}`}>
              {!message.ownMessage && <span className={styles.chatMessageAvatar}><ProfileAvatar avatarId={message.avatarId} size={32} /></span>}
              <div className={styles.chatMessageContent}>
                <span className={styles.chatMessageMeta}>
                  <strong>{message.ownMessage ? "나" : message.nickname}</strong>
                  <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time>
                </span>
                <p>{message.content}</p>
              </div>
            </li>
          ))}
          {chat.pending.map((pending) => (
            <li className={`${styles.chatMessage} ${styles.myChatMessage}`} key={pending.clientMessageId}>
              <div className={styles.chatMessageContent}>
                <span className={styles.chatMessageMeta}><strong>나</strong><span>{pending.state === "queued" ? "저장 확인 중" : "전송 상태 확인 필요"}</span></span>
                <p>{pending.content}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.chatFooter}>
        <p id={statusId} role="status">{composerError || status}</p>
        <form className={styles.chatComposer} aria-describedby={statusId} onSubmit={send}>
          <LobbyIcon name="smile" />
          <input
            aria-label="채팅 메시지"
            placeholder={connected ? "메시지를 입력하세요…" : "연결 후 입력할 수 있어요"}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); if (composerError) setComposerError(""); }}
            maxLength={1000}
            autoComplete="off"
            disabled={!connected}
          />
          <button type="submit" disabled={!connected || !draft.trim()} aria-label="메시지 전송">
            <LobbyIcon name="send" />
          </button>
        </form>
        {chat.state === "reconnecting" && <button type="button" className={styles.chatRetry} onClick={chat.retry}>다시 연결</button>}
      </div>
    </section>
  );
}
