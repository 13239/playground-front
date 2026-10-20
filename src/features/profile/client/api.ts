import { requestAuthenticatedApi, AuthRequestError } from "@/features/auth/client/api";
import type { ProfileAvatarId } from "../catalog";
import { isUserProfile, type UserProfile } from "../types";

/** 프로필 응답도 확인한 로그인 세션과 대조하고 인증 토큰이나 외부 이미지 주소를 브라우저에 저장하지 않는다. */
async function readProfileResponse(response: Response, sessionId: string): Promise<UserProfile> {
  let value: unknown;
  try { value = await response.json(); } catch { /* 허용된 공개 JSON 외의 응답은 사용하지 않는다. */ }
  if (!isUserProfile(value) || !("sessionId" in value) || typeof value.sessionId !== "string") {
    throw new AuthRequestError("프로필 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
  if (value.sessionId !== sessionId) {
    throw new AuthRequestError("로그인 상태가 변경되었습니다. 다시 확인해 주세요.", 409, undefined, "LOGIN_SESSION_CHANGED");
  }
  return { nickname: value.nickname, avatarId: value.avatarId };
}

export async function getProfile(sessionId: string): Promise<UserProfile> {
  return readProfileResponse(await requestAuthenticatedApi("/api/auth/profile"), sessionId);
}

export async function updateProfile(sessionId: string, avatarId: ProfileAvatarId): Promise<UserProfile> {
  return readProfileResponse(await requestAuthenticatedApi("/api/auth/profile", { sessionId, avatarId }), sessionId);
}
