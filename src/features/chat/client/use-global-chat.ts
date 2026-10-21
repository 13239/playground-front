"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthSession } from "@/features/auth/client/session-store";
import { EMPTY_CHAT, GlobalChatStore } from "./global-chat-store";
import type { ChatDestination } from "./protocol";

export type { PendingChatMessage, ChatConnectionState, ChatActionResult } from "./global-chat-store";

/** 로비 단위로 한 번만 연결한다. 화면에 동시에 존재하는 PC·모바일 패널은 상태를 공유한다. */
export function useGlobalChat() {
  return useChatConnection({ scope: "GLOBAL" });
}

/** 방 채팅도 공통 인증·메모리 상한·전송 복구를 재사용한다. 호출 컴포넌트는 방·참가 식별자로 구분한다. */
export function useChatConnection(destination: ChatDestination) {
  const auth = useAuthSession();
  const sessionId = auth.status === "authenticated" ? auth.session.sessionId : null;
  const [store] = useState(() => new GlobalChatStore(destination));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    if (sessionId) return store.connect(sessionId);
    // 잠깐의 인증 재확인에는 메모리를 숨긴 채 유지한다. 로그아웃·새 로그인에서는 이전 전송을 폐기한다.
    if (auth.status === "anonymous") store.clear();
    else store.disconnect();
  }, [store, sessionId, auth.status]);

  // 늦게 도착한 이전 세션의 응답이나 인증 재확인 중의 메시지가 새 계정 화면에 표시되지 않는다.
  const visible = sessionId && snapshot.sessionId === sessionId ? snapshot : EMPTY_CHAT;
  return { ...visible, sendMessage: store.sendMessage, loadOlder: store.loadOlder, loadPresence: store.loadPresence,
    returnToLatest: store.returnToLatest, retryHistory: store.retryHistory, retryMessage: store.retryMessage, retry: store.retry };
}

export type GlobalChat = ReturnType<typeof useGlobalChat>;
