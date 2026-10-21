import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";

/** 채팅 서버는 저장 완료 메시지·이력·접속자 정보만 공개하며 내부 사용자 식별자는 받지 않는다. */
export type PublicChatUser = Readonly<{ nickname: string; avatarId: ProfileAvatarId }>;
export type PublicChatMessage = Readonly<{
  id: string;
  clientMessageId?: string;
  nickname: string;
  avatarId: ProfileAvatarId;
  content: string;
  createdAt: string;
  ownMessage: boolean;
}>;

export type ChatEvent =
  | Readonly<{ type: "CHAT_MESSAGE"; message: PublicChatMessage }>
  | Readonly<{ type: "CHAT_ACCEPTED"; clientMessageId: string }>
  | Readonly<{ type: "CHAT_HISTORY_ITEM"; requestId: string; message: PublicChatMessage }>
  | Readonly<{ type: "CHAT_HISTORY_END"; requestId: string; hasMore: boolean; nextCursor: string | null }>
  | Readonly<{ type: "PRESENCE_CHANGED"; onlineCount: number }>
  | Readonly<{ type: "PRESENCE_SNAPSHOT"; onlineCount: number; onlineUsers: PublicChatUser[]; hasMore: boolean; nextOnlineOffset: number | null }>
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

function message(value: unknown): value is PublicChatMessage {
  return object(value) && typeof value.id === "string" && mongoIdPattern.test(value.id)
    && (value.clientMessageId === undefined || (typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId)))
    && user(value) && typeof value.content === "string" && [...value.content].length <= 1000
    && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.ownMessage === "boolean";
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** 알 수 없는 프레임·너무 큰 문자열·잘못된 서버 응답은 UI 상태에 반영하지 않는다. */
export function parseChatEvent(data: unknown): ChatEvent | null {
  if (typeof data !== "string" || data.length > 16_384) return null;
  let value: unknown;
  try { value = JSON.parse(data); } catch { return null; }
  if (!object(value) || value.version !== 1) return null;
  switch (value.type) {
    case "CHAT_MESSAGE":
      return message(value.message) ? { type: "CHAT_MESSAGE", message: value.message } : null;
    case "CHAT_ACCEPTED":
      return typeof value.clientMessageId === "string" && uuidPattern.test(value.clientMessageId)
        ? { type: "CHAT_ACCEPTED", clientMessageId: value.clientMessageId } : null;
    case "CHAT_HISTORY_ITEM":
      return typeof value.requestId === "string" && uuidPattern.test(value.requestId) && message(value.message)
        ? { type: "CHAT_HISTORY_ITEM", requestId: value.requestId, message: value.message } : null;
    case "CHAT_HISTORY_END":
      return typeof value.requestId === "string" && uuidPattern.test(value.requestId)
        && typeof value.hasMore === "boolean" && (value.nextCursor == null || typeof value.nextCursor === "string")
        && (!value.hasMore || typeof value.nextCursor === "string")
        ? { type: "CHAT_HISTORY_END", requestId: value.requestId, hasMore: value.hasMore, nextCursor: value.nextCursor ?? null } : null;
    case "PRESENCE_CHANGED":
      return validCount(value.onlineCount) ? { type: "PRESENCE_CHANGED", onlineCount: value.onlineCount } : null;
    case "PRESENCE_SNAPSHOT":
      return validCount(value.onlineCount) && Array.isArray(value.onlineUsers) && value.onlineUsers.length <= 100
        && value.onlineUsers.every(user) && typeof value.hasMore === "boolean"
        && (value.nextOnlineOffset == null || validCount(value.nextOnlineOffset))
        && (!value.hasMore || validCount(value.nextOnlineOffset))
        ? { type: "PRESENCE_SNAPSHOT", onlineCount: value.onlineCount, onlineUsers: value.onlineUsers,
            hasMore: value.hasMore, nextOnlineOffset: value.nextOnlineOffset ?? null } : null;
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
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  const json = JSON.stringify({ version: 1, ...frame });
  if (encoder.encode(json).length > 4096) return false;
  try { socket.send(json); return true; }
  catch { return false; }
}
