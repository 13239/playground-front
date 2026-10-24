"use client";

import { useEffect, useId, useRef } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { focusWithoutRing, showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { displayChatDate, type AdminChatMessage } from "../chat-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { ChatAuthor, ChatScopeBadge } from "./chat-message-display";
import admin from "./admin.module.css";
import styles from "./chat-history.module.css";

/** 선택 메시지만 읽고 닫을 때 해제한다. 긴 원문은 HTML로 해석하지 않고 줄바꿈을 보존한다. */
export function ChatMessageDialog({ id, close }: { id: string; close: () => void }) {
  const { sessionId } = useAdminScope();
  const resource = useAdminResource<AdminChatMessage>(sessionId, `chat/messages/${id}`);
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cleanupFocus = showModalWithoutCloseFocus(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cleanupFocus?.(); dialog?.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) focusWithoutRing(previousFocus); };
  }, []);
  const message = resource.data;
  return <dialog ref={ref} className={`${admin.dialog} ${admin.userDialog}`} aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }}>
    <div className={admin.userDialogTop}><div><span>CHAT MESSAGE</span><h2 id={title}>채팅 메시지 상세</h2></div><button type="button" className={admin.iconButton} aria-label="채팅 메시지 상세 닫기" title="닫기" onClick={close}><LobbyIcon name="close" /></button></div>
    <div className={admin.userDialogBody}>{!message ? <Loading error={resource.error} retry={resource.reload} /> : <>
      <dl className={admin.userFacts}>
        <div><dt>작성자 (전송 당시)</dt><dd><ChatAuthor message={message} /></dd></div><div><dt>전송 시각</dt><dd><time dateTime={message.sentAt}>{displayChatDate(message.sentAt)}</time></dd></div>
        <div><dt>채팅 구분</dt><dd><ChatScopeBadge scope={message.scope} /></dd></div><div><dt>게임</dt><dd>{message.gameName || "—"}</dd></div>
        <div><dt>방 번호</dt><dd>{message.roomId === null ? "—" : `#${message.roomId}`}</dd></div><div><dt>메시지 ID</dt><dd className={styles.messageId}>{message.id}</dd></div>
      </dl><section className={styles.messageSection}><h3>메시지 내용</h3><p className={styles.content}>{message.content}</p></section>
    </>}</div>
    <div className={admin.userDialogFooter}><button type="button" onClick={close}>닫기</button></div>
  </dialog>;
}
