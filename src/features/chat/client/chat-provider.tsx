"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGlobalChat, type GlobalChat } from "./use-global-chat";

const ChatContext = createContext<GlobalChat | null>(null);

/** 채팅 이벤트가 게임 목록 전체를 리렌더링하지 않도록 공유 연결을 별도 Provider에 둔다. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useGlobalChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

/** 데스크톱 채팅 패널과 모바일 dialog에서 하나의 채팅 연결·이력 상태를 소비한다. */
export function useChat(): GlobalChat {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error("채팅 화면은 ChatProvider 내부에서만 사용할 수 있습니다.");
  return chat;
}
