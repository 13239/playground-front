import { isProfileAvatarId, type ProfileAvatarId } from "./catalog";

export type UserProfile = Readonly<{ nickname: string; avatarId: ProfileAvatarId }>;

/** 서버·브라우저 모두 필요한 공개 필드만 검사하고 저장 경로나 임의 이미지 주소는 신뢰하지 않는다. */
export function isUserProfile(value: unknown): value is UserProfile {
  return typeof value === "object" && value !== null
    && "nickname" in value && typeof value.nickname === "string"
    && value.nickname.trim().length > 0 && [...value.nickname].length <= 50
    && "avatarId" in value && isProfileAvatarId(value.avatarId);
}
