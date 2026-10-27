import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";

/** 공용 채팅과 방 채팅은 별도 연결·메시지 창을 사용하며 방 번호는 서버 참가 검증 대상이다. */
export type ChatDestination = Readonly<{ scope: "GLOBAL" }> | Readonly<{ scope: "GAME_ROOM"; gameType: "GOMOKU"; roomId: number }> | Readonly<{scope: "SOCIAL"}>;

/** 채팅 서버는 저장 완료 메시지·이력·접속자 정보만 공개하며 내부 사용자 식별자는 받지 않는다. */
export type PublicChatUser = Readonly<{ nickname: string; avatarId: ProfileAvatarId }>;
// 공개 작성자 키는 닉네임 중복·변경과 관계없이 같은 작성자의 표시를 갱신하는 용도로만 사용한다.
export type PublicChatProfile = PublicChatUser & Readonly<{ authorKey: string; revision: number; publicUserId?: string }>;
export type PublicChatMessage = Readonly<{
  id: string;
  clientMessageId?: string;
  nickname: string;
  avatarId: ProfileAvatarId;
  content: string;
  createdAt: string;
  ownMessage: boolean;
  authorKey?: string;
  profileRevision?: number;
  // 프로필 팝업은 내부 회원 ID 대신 영속 공개 키만 사용한다.
  publicUserId?: string;
}>;

export type ChatEvent =
  | Readonly<{ type: "CHAT_PROFILE_CHANGED"; profile: PublicChatProfile }>
  | Readonly<{ type: "CHAT_MESSAGE"; message: PublicChatMessage }>
  | Readonly<{ type: "CHAT_ACCEPTED"; clientMessageId: string }>
  | Readonly<{ type: "CHAT_HISTORY_ITEM"; requestId: string; message: PublicChatMessage }>
  | Readonly<{ type: "CHAT_HISTORY_END"; requestId: string; hasMore: boolean; nextCursor: string | null }>
  | Readonly<{ type: "PRESENCE_CHANGED"; onlineCount: number }>
  | Readonly<{ type: "PRESENCE_SNAPSHOT"; requestId: string; onlineCount: number; onlineUsers: PublicChatUser[]; hasMore: boolean; nextOnlineCursor: string | null }>
  | Readonly<{ type: "CHAT_STATUS_RESULT"; clientMessageId: string; stored: boolean; message?: PublicChatMessage }>
  | Readonly<{ type: "CHAT_ERROR"; operation: string; code: string; retryAfterMillis: number; clientMessageId?: string; requestId?: string }>
  | Readonly<{ type: "PONG" }>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mongoIdPattern = /^[a-f0-9]{24}$/i;
const encoder = new TextEncoder();

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function user(value: unknown): value is PublicChatUser {
  return object(value) && typeof value.nickname === "string" && value.nickname.trim().length > 0
    && [...value.nickname].length <= 50 && isProfileAvatarId(value.avatarId);
}

function message(value: unknown, destination: ChatDestination): value is PublicChatMessage {
  return object(value) && typeof value.id === "string" && mongoIdPattern.test(value.id)
    && value.scope === destination.scope
    && (destination.scope === "GLOBAL" ? value.gameType == null && value.roomId == null
      : destination.scope === "GAME_ROOM" && value.gameType === destination.gameType && value.roomId === destination.roomId)
    && (value.clientMessageId === undefined || (typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId)))
    // 사용자 타입으로 좁히기 전에 메시지 고유 필드를 검증해 타입 정보가 사라지지 않게 한다.
    && typeof value.content === "string" && [...value.content].length <= 1000
    && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.ownMessage === "boolean"
    // 구버전 배포와의 호환성은 유지하되 새 작성자 메타데이터는 두 필드를 함께 검증한다.
    && (value.authorKey == null && value.profileRevision == null || typeof value.authorKey === "string" && uuidPattern.test(value.authorKey)
      && validCount(value.profileRevision))
    && (value.publicUserId == null || typeof value.publicUserId === "string" && uuidPattern.test(value.publicUserId)) && user(value);
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** 알 수 없는 프레임·너무 큰 문자열·잘못된 서버 응답은 UI 상태에 반영하지 않는다. */
export function parseChatEvent(data: unknown, destination: ChatDestination = { scope: "GLOBAL" }): ChatEvent | null {
  if (typeof data !== "string" || data.length > 16_384) return null;
  let value: unknown;
  try { value = JSON.parse(data); } catch { return null; }
  if (!object(value) || value.version !== 1) return null;
  switch (value.type) {
    case "CHAT_PROFILE_CHANGED":
      return user(value.profile) && "authorKey" in value.profile && typeof value.profile.authorKey === "string" && uuidPattern.test(value.profile.authorKey)
        && "revision" in value.profile && validCount(value.profile.revision)
        ? { type: "CHAT_PROFILE_CHANGED", profile: value.profile as PublicChatProfile } : null;
    case "CHAT_MESSAGE":
      return message(value.message, destination) ? { type: "CHAT_MESSAGE", message: value.message } : null;
    case "CHAT_ACCEPTED":
      return typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId)
        ? { type: "CHAT_ACCEPTED", clientMessageId: value.clientMessageId } : null;
    case "CHAT_HISTORY_ITEM":
      return typeof value.requestId === "string" && uuidPattern.test(value.requestId) && message(value.message, destination)
        ? { type: "CHAT_HISTORY_ITEM", requestId: value.requestId, message: value.message } : null;
    case "CHAT_HISTORY_END":
      return typeof value.requestId === "string" && uuidPattern.test(value.requestId)
        && typeof value.hasMore === "boolean" && (value.nextCursor == null || typeof value.nextCursor === "string")
        && (!value.hasMore || typeof value.nextCursor === "string")
        ? { type: "CHAT_HISTORY_END", requestId: value.requestId, hasMore: value.hasMore, nextCursor: value.nextCursor ?? null } : null;
    case "PRESENCE_CHANGED":
      return validCount(value.onlineCount) ? { type: "PRESENCE_CHANGED", onlineCount: value.onlineCount } : null;
    case "PRESENCE_SNAPSHOT":
      return typeof value.requestId === "string" && uuidPattern.test(value.requestId)
        && validCount(value.onlineCount) && Array.isArray(value.onlineUsers) && value.onlineUsers.length <= 100
        && value.onlineUsers.every(user) && typeof value.hasMore === "boolean"
        && (value.nextOnlineCursor == null || typeof value.nextOnlineCursor === "string" && uuidPattern.test(value.nextOnlineCursor))
        && (!value.hasMore || typeof value.nextOnlineCursor === "string")
        ? { type: "PRESENCE_SNAPSHOT", requestId: value.requestId, onlineCount: value.onlineCount, onlineUsers: value.onlineUsers,
            hasMore: value.hasMore, nextOnlineCursor: value.nextOnlineCursor ?? null } : null;
    case "CHAT_STATUS_RESULT":
      // 다른 사용자의 결과나 요청 UUID가 다른 메시지를 전송 완료로 처리하지 않는다.
      return typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId)
        && typeof value.stored === "boolean"
        && (value.stored ? message(value.message, destination) && value.message.ownMessage
          && value.message.clientMessageId === value.clientMessageId : value.message == null)
        ? { type: "CHAT_STATUS_RESULT", clientMessageId: value.clientMessageId, stored: value.stored,
            ...(value.stored ? { message: value.message as PublicChatMessage } : {}) } : null;
    case "CHAT_ERROR":
      return typeof value.operation === "string"
        && ["CHAT_SEND", "CHAT_HISTORY", "CHAT_STATUS", "PRESENCE_GET"].includes(value.operation)
        && value.code === "CHAT_REQUEST_RATE_LIMIT_EXCEEDED"
        && validCount(value.retryAfterMillis) && value.retryAfterMillis > 0 && value.retryAfterMillis <= 60_000
        && (value.clientMessageId == null || typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId))
        && (value.requestId == null || typeof value.requestId === "string" && uuidPattern.test(value.requestId))
        ? { type: "CHAT_ERROR", operation: value.operation, code: value.code,
            retryAfterMillis: value.retryAfterMillis,
            ...(typeof value.clientMessageId === "string" ? { clientMessageId: value.clientMessageId } : {}),
            ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}) } : null;
    case "PONG": return { type: "PONG" };
    default: return null;
  }
}

/** 서버의 프레임 상한(4096바이트)과 메시지 검증(1000 코드포인트·3500 UTF-8바이트)을 함께 적용한다. */
export function validatedChatContent(input: string): string | null {
  if (input.length > 3500) return null;
  const content = input.trim();
  if (!content || [...content].length > 1000 || encoder.encode(content).length > 3500) return null;
  for (const character of content) {
    const cp = character.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff || cp <= 0x1f && cp !== 0x0a && cp !== 0x09
      || cp >= 0x7f && cp <= 0x9f || /\p{Cf}/u.test(character)) return null;
  }
  return content;
}

export function sendChatFrame(socket: WebSocket | null, frame: object): boolean {
  // 브라우저의 송신 대기도 제한해 끊긴 네트워크에서 메시지가 메모리에 계속 쌓이지 않게 한다.
  if (!socket || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 65_536) return false;
  const json = JSON.stringify({ version: 1, ...frame });
  if (encoder.encode(json).length > 4096) return false;
  try { socket.send(json); return true; }
  catch { return false; }
}
