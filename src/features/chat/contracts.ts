import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";

export type ChatTicket = Readonly<{
  ticket: string;
  serverTime: string;
  expiresAt: string;
  websocketUrl: string;
  proofRequired: boolean;
}>;

export type ChatUser = Readonly<{ nickname: string; avatarId: ProfileAvatarId }>;
export type ChatAuthenticatedFrame = Readonly<{
  version: 1;
  type: "AUTHENTICATED";
  connectionId: string;
  user: ChatUser;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 짧은 일회용 증명만 수신하고 임의의 서버 필드나 장기 인증 토큰을 재공개하지 않는다. */
export function isChatTicket(value: unknown): value is ChatTicket {
  if (!isObject(value) || typeof value.ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.ticket)
    || typeof value.serverTime !== "string" || typeof value.expiresAt !== "string"
    || typeof value.websocketUrl !== "string" || value.websocketUrl.length > 2048
    || typeof value.proofRequired !== "boolean") return false;
  const duration = Date.parse(value.expiresAt) - Date.parse(value.serverTime);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30_000) return false;
  try {
    const url = new URL(value.websocketUrl);
    return ["ws:", "wss:"].includes(url.protocol) && !url.username && !url.password
      && url.pathname === "/ws/chat" && !url.search && !url.hash;
  } catch { return false; }
}

export function publicChatTicket(value: ChatTicket): ChatTicket {
  return { ticket: value.ticket, serverTime: value.serverTime, expiresAt: value.expiresAt,
    websocketUrl: value.websocketUrl, proofRequired: value.proofRequired };
}

/** 인증 완료 프레임에는 로그인 아이디나 세션·사용자 내부 식별자를 요구하지 않는다. */
export function isChatAuthenticatedFrame(value: unknown): value is ChatAuthenticatedFrame {
  return isObject(value) && value.version === 1 && value.type === "AUTHENTICATED"
    && typeof value.connectionId === "string"
    && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.connectionId)
    && isObject(value.user) && typeof value.user.nickname === "string"
    && value.user.nickname.trim().length > 0 && [...value.user.nickname].length <= 50
    && isProfileAvatarId(value.user.avatarId);
}
