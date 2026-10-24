import { createUuidV4 } from "@/lib/client/uuid";
import { SignJWT } from "jose";
import { requestAuthenticatedApi, AuthRequestError } from "@/features/auth/client/api";
import { getBrowserKey } from "@/features/auth/client/browser-key";
import { isDevHttpAuth } from "@/features/auth/client/environment";
import { withAuthRequestContext } from "@/features/auth/client/request-context";
import type { ChatDestination } from "./protocol";
import { isChatAuthenticatedFrame, isChatTicket, publicChatTicket,
  type ChatTicket, type ChatUser } from "../contracts";

export type AuthenticatedChatConnection = Readonly<{
  socket: WebSocket;
  connectionId: string;
  user: ChatUser;
  // 서버 시계로 정한 이번 연결 시각이다. 홈의 최초 연결 경계는 재연결에서도 유지한다.
  serverTime: string;
  // AUTHENTICATED 직후 수신된 접속자 변경·채팅 방송을 화면 구독 전까지 보관한다.
  takeBufferedFrames: () => readonly string[];
  close: () => void;
}>;

type ReceivedTicket = ChatTicket & Readonly<{ receivedAt: number }>;

/** 발급·서명·소켓 열기 사이의 지연도 확인해 만료된 티켓을 로그인 오류로 처리하지 않는다. */
function assertTicketValid(ticket: ReceivedTicket): void {
  if (performance.now() - ticket.receivedAt >= Date.parse(ticket.expiresAt) - Date.parse(ticket.serverTime)) {
    throw new AuthRequestError("채팅 접속 정보가 만료되었습니다. 다시 연결해 주세요.", 401, undefined, "CHAT_TICKET_INVALID");
  }
}

/** 일시 장애·시간 초과·증명 거절을 구분하며 서버의 임의 종료 문구는 화면에 표시하지 않는다. */
export function chatConnectionError(code: number, reason: string): AuthRequestError {
  if (code === 4401 && reason === "ACCESS_RESTRICTED") {
    return new AuthRequestError("로그인 상태가 변경되었습니다. 현재 접속 상태를 다시 확인합니다.", 401, undefined, "ACCESS_RESTRICTED");
  }
  if (code === 4401 && reason === "INVALID_SESSION") {
    return new AuthRequestError("로그인이 만료되었습니다. 다시 로그인해 주세요.", 401, undefined, "INVALID_SESSION");
  }
  if (code === 4401) return new AuthRequestError("채팅 접속 정보를 다시 발급받아 연결해 주세요.", 401, undefined, "CHAT_TICKET_INVALID");
  if (code === 4403 && reason === "CHAT_ROOM_ACCESS_DENIED") {
    return new AuthRequestError("현재 방의 채팅 참가 상태를 확인하고 있습니다.", 403, undefined, "CHAT_ROOM_ACCESS_DENIED");
  }
  if (code === 4403) return new AuthRequestError("브라우저의 채팅 접속 인증을 확인할 수 없습니다.", 403, undefined, "CHAT_PROOF_INVALID");
  if (code === 4408) return new AuthRequestError("채팅 연결 응답이 지연되고 있습니다.", 504, undefined, "CHAT_CONNECTION_TIMEOUT");
  if (code === 1008) return new AuthRequestError("채팅 연결 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429, undefined, "CHAT_CONNECTION_RATE_LIMIT_EXCEEDED");
  return new AuthRequestError("채팅 서비스를 일시적으로 이용할 수 없습니다.", 503, undefined, "CHAT_CONNECTION_UNAVAILABLE");
}

/** 기존 인증 잠금·갱신·브라우저 증명으로 발급하며 원문 증명을 저장소나 URL에 기록하지 않는다. */
export async function requestChatTicket(sessionId: string, signal?: AbortSignal): Promise<ReceivedTicket> {
  // 연결을 정리한 화면의 티켓 요청도 인증 잠금 대기부터 취소한다.
  const response = await requestAuthenticatedApi("/api/chat/tickets", { sessionId }, signal);
  let value: unknown;
  try { value = await response.json(); } catch { /* 허용한 JSON 계약 외의 응답은 사용하지 않는다. */ }
  signal?.throwIfAborted();
  if (!isChatTicket(value) || !("sessionId" in value) || value.sessionId !== sessionId) {
    throw new AuthRequestError("채팅 접속 정보를 확인하지 못했습니다.", 502, undefined, "INVALID_BACKEND_RESPONSE");
  }
  return { ...publicChatTicket(value), receivedAt: performance.now() };
}

/** 접속 증명 해시와 실제 WebSocket 주소를 기존 추출 불가 로그인 키에 결합한다. */
async function authenticationFrame(ticket: ReceivedTicket): Promise<object> {
  assertTicketValid(ticket);
  if (!ticket.proofRequired) {
    if (!isDevHttpAuth()) throw new AuthRequestError("채팅 접속 인증 설정이 올바르지 않습니다.", 403, undefined, "CHAT_CONFIGURATION_ERROR");
    return { version: 1, type: "AUTH", ticket: ticket.ticket };
  }
  const key = await getBrowserKey(false);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket.ticket));
  const ticketHash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const proof = await new SignJWT({ ticketHash, htu: ticket.websocketUrl })
    .setProtectedHeader({ alg: "ES256", typ: "chat-connection-proof+jwt", jwk: key.publicKey })
    .setJti(createUuidV4())
    .setIssuedAt(Math.floor((Date.parse(ticket.serverTime) + performance.now() - ticket.receivedAt) / 1000))
    .sign(key.privateKey);
  assertTicketValid(ticket);
  return { version: 1, type: "AUTH", ticket: ticket.ticket, proof };
}

/** AUTHENTICATED를 확인한 뒤 연결을 넘기며 후속 메시지는 화면 구독 전까지 유한 버퍼에 보관한다. */
export async function connectChat(sessionId: string, signal?: AbortSignal,
  destination: ChatDestination = { scope: "GLOBAL" }, onTicketIssued?: (serverTime: string) => void): Promise<AuthenticatedChatConnection> {
  // 티켓 발급·키 준비·핸드셰이크 전체를 같은 기한과 취소에 묶고 인증 완료 뒤에는 소켓 수명으로 전환한다.
  return withAuthRequestContext(context => openChat(sessionId, context.signal, destination, onTicketIssued), signal);
}

async function openChat(sessionId: string, signal: AbortSignal | undefined,
  destination: ChatDestination, onTicketIssued?: (serverTime: string) => void): Promise<AuthenticatedChatConnection> {
  signal?.throwIfAborted();
  const ticket = await requestChatTicket(sessionId, signal);
  signal?.throwIfAborted();
  // 최초 티켓의 시각은 소켓 준비보다 먼저 알려 초기 연결 실패 중의 대화도 다음 연결에서 복구한다.
  onTicketIssued?.(ticket.serverTime);
  const frame = await authenticationFrame(ticket);
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(ticket.websocketUrl);
    let settled = false;
    let bufferedListener: ((event: MessageEvent<unknown>) => void) | undefined;
    const timer = setTimeout(() => fail(new AuthRequestError("채팅 연결 응답이 지연되고 있습니다.", 504, undefined, "CHAT_CONNECTION_TIMEOUT")), 10_000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener("open", opened);
      socket.removeEventListener("message", message);
      socket.removeEventListener("error", error);
    };
    const close = () => {
      signal?.removeEventListener("abort", aborted);
      socket.removeEventListener("close", closed);
      cleanup();
      if (bufferedListener) socket.removeEventListener("message", bufferedListener);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Client closed");
      }
    };
    const fail = (failure: unknown) => {
      if (settled) return;
      settled = true;
      close();
      reject(failure);
    };
    // 방 번호는 첫 AUTH에서만 지정하고 이후 연결 대상은 서버가 고정한다.
    const opened = () => {
      // 핸드셰이크가 지연됐거나 직전에 닫힌 소켓도 같은 복구 경로로 처리한다.
      try { assertTicketValid(ticket); socket.send(JSON.stringify({ ...frame, ...destination })); }
      catch (error) { fail(error instanceof AuthRequestError ? error : new AuthRequestError("채팅 서비스에 연결할 수 없습니다.", 503, undefined, "CHAT_CONNECTION_UNAVAILABLE")); }
    };
    const aborted = () => {
      if (settled) close();
      else fail(new DOMException("채팅 연결이 취소되었습니다.", "AbortError"));
    };
    const error = () => fail(new AuthRequestError("채팅 서비스에 연결할 수 없습니다.", 503, undefined, "CHAT_CONNECTION_UNAVAILABLE"));
    const closed = (event: CloseEvent) => {
      signal?.removeEventListener("abort", aborted);
      socket.removeEventListener("close", closed);
      if (!settled) fail(chatConnectionError(event.code, event.reason));
    };
    const message = (event: MessageEvent<unknown>) => {
      let value: unknown;
      try { if (typeof event.data === "string" && event.data.length <= 4096) value = JSON.parse(event.data); }
      catch { /* 원문 프레임을 오류 메시지에 복사하지 않는다. */ }
      if (!isChatAuthenticatedFrame(value)) {
        fail(new AuthRequestError("채팅 접속 응답을 확인하지 못했습니다.", 502, undefined, "CHAT_PROTOCOL_INVALID"));
        return;
      }
      settled = true;
      cleanup();
      const bufferedFrames: string[] = [];
      // 인증 프레임 뒤에 같은 네트워크 패킷으로 도착한 방송도 잃지 않는다. 메모리는 최대 128프레임으로 제한한다.
      bufferedListener = (next) => {
        if (bufferedFrames.length < 128 && typeof next.data === "string" && next.data.length <= 16_384) {
          bufferedFrames.push(next.data);
        }
      };
      socket.addEventListener("message", bufferedListener);
      const takeBufferedFrames = () => {
        if (bufferedListener) socket.removeEventListener("message", bufferedListener);
        bufferedListener = undefined;
        return bufferedFrames.splice(0);
      };
      resolve({ socket, connectionId: value.connectionId, serverTime: ticket.serverTime,
        user: { nickname: value.user.nickname, avatarId: value.user.avatarId }, takeBufferedFrames, close });
    };
    socket.addEventListener("open", opened);
    socket.addEventListener("message", message);
    socket.addEventListener("error", error);
    socket.addEventListener("close", closed);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}
