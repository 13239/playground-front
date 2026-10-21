"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { connectChat } from "./connection";
import { parseChatEvent, sendChatFrame, validatedChatContent,
  type PublicChatMessage, type PublicChatUser } from "./protocol";

const HISTORY_LIMIT = 30;
const PRESENCE_LIMIT = 50;
const MAX_VISIBLE_MESSAGES = 500;
const RETRY_MAX_MS = 15_000;

export type PendingChatMessage = Readonly<{
  clientMessageId: string;
  content: string;
  state: "queued" | "unconfirmed";
}>;
export type ChatConnectionState = "login" | "connecting" | "connected" | "reconnecting" | "expired";
export type ChatActionResult = Readonly<{ ok: boolean; message?: string }>;

function addMessage(current: PublicChatMessage[], incoming: PublicChatMessage): PublicChatMessage[] {
  if (current.some((item) => item.id === incoming.id)) return current;
  return [...current, incoming]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-MAX_VISIBLE_MESSAGES);
}

/** 로비 단위로 한 번만 연결한다. 화면에 동시에 존재하는 PC·모바일 패널은 상태를 공유한다. */
export function useGlobalChat() {
  const auth = useAuthSession();
  const sessionId = auth.status === "authenticated" ? auth.session.sessionId : null;
  const socketRef = useRef<WebSocket | null>(null);
  const historyRequest = useRef<string | null>(null);
  const presenceRequest = useRef<{ offset: number; lastSentAt: number } | null>(null);
  const presenceInFlight = useRef(false);
  const nextCursor = useRef<string | null>(null);
  const lastHistoryAt = useRef(Number.NEGATIVE_INFINITY);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSendAt = useRef(Number.NEGATIVE_INFINITY);
  const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ChatConnectionState>("login");
  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [pending, setPending] = useState<PendingChatMessage[]>([]);
  const [history, setHistory] = useState<"idle" | "loading" | "more" | "done" | "error">("idle");
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PublicChatUser[]>([]);
  const [onlineNextOffset, setOnlineNextOffset] = useState<number | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  const loadHistory = useCallback((before: string | null = null): boolean => {
    const now = performance.now();
    // 서버의 CHAT_HISTORY 500ms 제한을 넘기면 WebSocket 자체가 종료된다.
    if (historyRequest.current || now - lastHistoryAt.current < 650) return false;
    const id = crypto.randomUUID();
    if (!sendChatFrame(socketRef.current, {
      type: "CHAT_HISTORY", scope: "GLOBAL", requestId: id, limit: HISTORY_LIMIT,
      ...(before ? { before } : {}),
    })) return false;
    lastHistoryAt.current = now;
    historyRequest.current = id;
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      if (historyRequest.current === id) { historyRequest.current = null; setHistory("error"); }
    }, 15_000);
    setHistory("loading");
    return true;
  }, []);

  const loadOlder = useCallback((): boolean => {
    if (historyRequest.current || !nextCursor.current) return false;
    return loadHistory(nextCursor.current);
  }, [loadHistory]);

  const loadPresence = useCallback((offset = 0): boolean => {
    const now = performance.now();
    // 서버는 접속자 목록 요청 간격이 1초 미만이면 연결을 종료하므로 클라이언트에서도 제한한다.
    if (presenceInFlight.current || presenceRequest.current && now - presenceRequest.current.lastSentAt < 1200) return false;
    if (!sendChatFrame(socketRef.current, { type: "PRESENCE_GET", onlineOffset: offset, onlineLimit: PRESENCE_LIMIT })) return false;
    presenceRequest.current = { offset, lastSentAt: now };
    presenceInFlight.current = true;
    if (presenceTimer.current) clearTimeout(presenceTimer.current);
    presenceTimer.current = setTimeout(() => {
      presenceInFlight.current = false;
      setOnlineLoading(false);
    }, 10_000);
    setOnlineLoading(true);
    if (offset === 0) { setOnlineUsers([]); setOnlineNextOffset(null); }
    return true;
  }, []);

  const sendMessage = useCallback((input: string): ChatActionResult => {
    const content = validatedChatContent(input);
    if (!content) return { ok: false, message: "메시지는 1~1000자이며 제어 문자와 과도한 길이는 사용할 수 없어요." };
    if (performance.now() - lastSendAt.current < 250) {
      return { ok: false, message: "잠시 후 메시지를 보내 주세요." };
    }
    const clientMessageId = crypto.randomUUID();
    if (!sendChatFrame(socketRef.current, { type: "CHAT_SEND", scope: "GLOBAL", clientMessageId, content })) {
      return { ok: false, message: "채팅 연결을 확인한 뒤 다시 전송해 주세요." };
    }
    lastSendAt.current = performance.now();
    // Kafka 접수는 MongoDB 저장 확정이 아니므로 서버의 CHAT_MESSAGE까지 전송 중으로 표시한다.
    setPending((current) => [...current.slice(-19), { clientMessageId, content, state: "queued" }]);
    // Kafka 접수 후 DB 확정 이벤트가 오지 않을 때 전송 완료로 오인하지 않는다.
    pendingTimers.current.set(clientMessageId, setTimeout(() => {
      pendingTimers.current.delete(clientMessageId);
      setPending((current) => current.map((item) => item.clientMessageId === clientMessageId
        ? { ...item, state: "unconfirmed" } : item));
    }, 30_000));
    return { ok: true };
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let retries = 0;
    let connectionClose: (() => void) | undefined;
    let currentSocket: WebSocket | undefined;
    const abort = new AbortController();
    socketRef.current = null;
    historyRequest.current = null;
    presenceRequest.current = null;
    presenceInFlight.current = false;
    nextCursor.current = null;
    lastSendAt.current = Number.NEGATIVE_INFINITY;
    lastHistoryAt.current = Number.NEGATIVE_INFINITY;
    for (const timer of pendingTimers.current.values()) clearTimeout(timer);
    pendingTimers.current.clear();
    if (historyTimer.current) clearTimeout(historyTimer.current);
    if (presenceTimer.current) clearTimeout(presenceTimer.current);
    setMessages([]);
    setPending([]);
    setHistory("idle");
    setOnlineCount(null);
    setOnlineUsers([]);
    setOnlineNextOffset(null);
    setOnlineLoading(false);

    if (!sessionId) {
      setState("login");
      return () => { active = false; abort.abort(); };
    }

    const reconnect = () => {
      if (!active) return;
      socketRef.current = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = undefined;
      historyRequest.current = null;
      if (historyTimer.current) clearTimeout(historyTimer.current);
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
      presenceRequest.current = null;
      presenceInFlight.current = false;
      setOnlineCount(null);
      setOnlineUsers([]);
      setOnlineNextOffset(null);
      setOnlineLoading(false);
      setPending((current) => current.map((item) => ({ ...item, state: "unconfirmed" })));
      setState("reconnecting");
      const delay = Math.min(RETRY_MAX_MS, 1000 * 2 ** Math.min(retries++, 4));
      retryTimer = setTimeout(() => { void establish(); }, delay + Math.floor(Math.random() * 400));
    };

    const establish = async () => {
      if (!active) return;
      setState(retries > 0 ? "reconnecting" : "connecting");
      try {
        const connection = await connectChat(sessionId, abort.signal);
        if (!active) { connection.close(); return; }
        connectionClose = connection.close;
        currentSocket = connection.socket;
        socketRef.current = connection.socket;
        setState("connected");
        setHistory("idle");
        const socket = connection.socket;
        const onMessage = (event: MessageEvent<unknown>) => {
          const frame = parseChatEvent(event.data);
          if (!frame || !active) return;
          switch (frame.type) {
            case "CHAT_MESSAGE":
              setMessages((current) => addMessage(current, frame.message));
              if (frame.message.clientMessageId) {
                const timer = pendingTimers.current.get(frame.message.clientMessageId);
                if (timer) clearTimeout(timer);
                pendingTimers.current.delete(frame.message.clientMessageId);
                setPending((current) => current.filter((item) => item.clientMessageId !== frame.message.clientMessageId));
              }
              break;
            case "CHAT_HISTORY_ITEM":
              if (frame.requestId !== historyRequest.current) break;
              setMessages((current) => addMessage(current, frame.message));
              if (frame.message.clientMessageId) {
                const timer = pendingTimers.current.get(frame.message.clientMessageId);
                if (timer) clearTimeout(timer);
                pendingTimers.current.delete(frame.message.clientMessageId);
                setPending((current) => current.filter((item) => item.clientMessageId !== frame.message.clientMessageId));
              }
              break;
            case "CHAT_HISTORY_END":
              if (frame.requestId !== historyRequest.current) break;
              historyRequest.current = null;
              if (historyTimer.current) clearTimeout(historyTimer.current);
              historyTimer.current = undefined;
              nextCursor.current = frame.nextCursor;
              setHistory(frame.hasMore ? "more" : "done");
              break;
            case "PRESENCE_CHANGED":
              setOnlineCount(frame.onlineCount);
              break;
            case "PRESENCE_SNAPSHOT": {
              const request = presenceRequest.current;
              if (!request) break;
              setOnlineCount(frame.onlineCount);
              setOnlineUsers((current) => request.offset === 0 ? frame.onlineUsers : [...current, ...frame.onlineUsers]);
              setOnlineNextOffset(frame.nextOnlineOffset);
              setOnlineLoading(false);
              presenceInFlight.current = false;
              if (presenceTimer.current) clearTimeout(presenceTimer.current);
              presenceTimer.current = undefined;
              // 이전 페이지의 요청 시각은 보존하여 연달아 조회할 때 서버 제한을 지킨다.
              break;
            }
            case "CHAT_ACCEPTED":
            case "PONG": break;
          }
        };
        const onClose = (event: CloseEvent) => {
          socket.removeEventListener("message", onMessage);
          socket.removeEventListener("close", onClose);
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = undefined;
          if (!active || socketRef.current !== socket) return;
          connectionClose = undefined;
          currentSocket = undefined;
          if (event.code === 4401 || event.code === 4403) {
            socketRef.current = null;
            setState("expired");
            revalidateAuthSession();
          } else reconnect();
        };
        socket.addEventListener("message", onMessage);
        socket.addEventListener("close", onClose);
        for (const data of connection.takeBufferedFrames()) onMessage({ data } as MessageEvent<string>);
        // 연결이 인증 직후 종료된 경우 close 이벤트를 놓치지 않고 바로 재접속한다.
        if (socket.readyState !== WebSocket.OPEN) {
          socket.removeEventListener("message", onMessage);
          socket.removeEventListener("close", onClose);
          connection.close();
          reconnect();
          return;
        }
        // 서버는 90초 입력 대기 제한을 적용하므로 25초 주기의 경량 PING을 보낸다.
        pingTimer = setInterval(() => { sendChatFrame(socket, { type: "PING" }); }, 25_000);
        // 재연결 직후 최근 저장 메시지를 재조회해 Kafka 전파 누락도 복구한다.
        loadHistory();
      } catch (error) {
        if (!active || abort.signal.aborted) return;
        if (error instanceof AuthRequestError && (error.status === 401 || error.status === 403)) {
          setState("expired");
          revalidateAuthSession();
          return;
        }
        reconnect();
      }
    };
    void establish();
    return () => {
      active = false;
      abort.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (historyTimer.current) clearTimeout(historyTimer.current);
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
      for (const timer of pendingTimers.current.values()) clearTimeout(timer);
      pendingTimers.current.clear();
      socketRef.current = null;
      connectionClose?.();
      if (currentSocket && currentSocket.readyState === WebSocket.OPEN) currentSocket.close(1000);
    };
  }, [sessionId, revision, loadHistory]);

  return {
    state, messages, pending, history, onlineCount, onlineUsers, onlineNextOffset, onlineLoading,
    sendMessage, loadOlder, loadPresence, retry: () => setRevision((value) => value + 1),
  };
}

export type GlobalChat = ReturnType<typeof useGlobalChat>;
