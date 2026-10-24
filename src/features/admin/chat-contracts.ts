import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";
import { gameCodePattern } from "@/features/games/contracts";
import { parseNumberedPage } from "./pagination-contracts";

/** 일반 채팅의 현재 프로필 응답과 분리된 전송 당시 스냅샷 계약이다. */
export type AdminChatMessage = Readonly<{ id: string; sentAt: string; authorId: number; authorNickname: string; authorAvatarId: ProfileAvatarId;
  scope: "GLOBAL" | "GAME_ROOM"; gameCode: string | null; gameName: string | null; roomId: number | null; content: string }>;
export type AdminChatGame = Readonly<{ code: string; name: string }>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string => typeof value === "string" && [...value].length > 0 && [...value].length <= limit;
const id = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
function assert(value: unknown): asserts value { if (!value) throw new Error("Invalid admin chat response"); }

/** 내부 필드가 추가돼도 브라우저에는 승인된 표시 필드만 반환한다. */
export function parseAdminChatMessage(value: unknown): AdminChatMessage {
  assert(object(value) && typeof value.id === "string" && /^[a-f0-9]{24}$/.test(value.id)
    && typeof value.sentAt === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.sentAt) && Number.isFinite(Date.parse(value.sentAt))
    && id(value.authorId) && text(value.authorNickname, 50) && isProfileAvatarId(value.authorAvatarId)
    && (value.scope === "GLOBAL" || value.scope === "GAME_ROOM") && text(value.content, 1000));
  if (value.scope === "GLOBAL") assert(value.gameCode === null && value.gameName === null && value.roomId === null);
  else assert(typeof value.gameCode === "string" && gameCodePattern.test(value.gameCode) && text(value.gameName, 100) && id(value.roomId));
  return { id: value.id, sentAt: value.sentAt, authorId: value.authorId, authorNickname: value.authorNickname, authorAvatarId: value.authorAvatarId,
    scope: value.scope, gameCode: value.gameCode as string | null, gameName: value.gameName as string | null, roomId: value.roomId as number | null, content: value.content };
}
export const parseAdminChatPage = (value: unknown) => parseNumberedPage(value, parseAdminChatMessage);
export function parseAdminChatGames(value: unknown): readonly AdminChatGame[] {
  assert(Array.isArray(value));
  const seen = new Set<string>();
  return value.map(item => { assert(object(item) && typeof item.code === "string" && gameCodePattern.test(item.code) && text(item.name, 100) && !seen.has(item.code));
    seen.add(item.code); return { code: item.code, name: item.name }; });
}

// 저장 시각은 UTC Instant이므로 문자열 치환 대신 KST로 변환한다. 브라우저 지역 설정과 무관하다.
const dateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export const displayChatDate = (value: string) => dateFormat.format(new Date(value));
