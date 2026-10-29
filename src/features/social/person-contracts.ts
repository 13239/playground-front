import {
  isProfileAvatarId,
  type ProfileAvatarId,
} from "@/features/profile/catalog";

/** 공개 프로필 계약은 소셜·게임 초대가 순환 의존 없이 공유한다. */
export const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && [...v].length <= max;
const id = (v: unknown): v is string => typeof v === "string" && uuid.test(v);
export type Person = Readonly<{
  publicId: string;
  nickname: string;
  avatarId: ProfileAvatarId;
  relation:
    | "SELF"
    | "NONE"
    | "FRIEND"
    | "SENT"
    | "RECEIVED"
    | "BLOCKED"
    | "UNAVAILABLE";
  requestId?: string;
  online?: boolean;
  blocked?: boolean;
}>;
export function isPerson(v: unknown): v is Person {
  return (
    object(v) &&
    id(v.publicId) &&
    text(v.nickname, 50) &&
    v.nickname.length > 0 &&
    isProfileAvatarId(v.avatarId) &&
    [
      "SELF",
      "NONE",
      "FRIEND",
      "SENT",
      "RECEIVED",
      "BLOCKED",
      "UNAVAILABLE",
    ].includes(v.relation as string) &&
    (v.requestId == null || id(v.requestId)) &&
    (v.online == null || typeof v.online === "boolean") &&
    (v.blocked == null || typeof v.blocked === "boolean")
  );
}
