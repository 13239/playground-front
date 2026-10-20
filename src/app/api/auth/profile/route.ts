import { readAuthCookie } from "@/features/auth/server/cookies";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { isProfileAvatarId } from "@/features/profile/catalog";
import { isUserProfile } from "@/features/profile/types";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 본인 프로필만 조회하고 브라우저가 이전 계정의 응답을 사용할 수 없도록 실제 세션 ID를 결합한다. */
export async function GET(request: Request): Promise<Response> {
  try {
    const proof = await readBrowserProof(request);
    const session = await readAuthCookie();
    if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
    const profile = await withAuthenticatedSession(proof,
      (accessToken, proof) => backendRequest("/api/auth/profile", { accessToken, proof }), session.sessionId);
    if (!isUserProfile(profile)) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({ nickname: profile.nickname, avatarId: profile.avatarId, sessionId: session.sessionId },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

/** 동일 Origin·실제 본문 서명·화면의 세션을 모두 확인한 뒤 제공된 캐릭터 식별자 하나만 변경한다. */
export async function PUT(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 512);
    if (typeof input !== "object" || input === null || !("sessionId" in input) || !isSessionId(input.sessionId)
      || !("avatarId" in input) || !isProfileAvatarId(input.avatarId)) throw new ApiError("INVALID_REQUEST_BODY");
    const avatarId = input.avatarId;
    const profile = await withAuthenticatedSession(proof,
      (accessToken, proof) => backendRequest("/api/auth/profile", {
        method: "PUT", body: { avatarId }, accessToken, proof,
      }), input.sessionId);
    if (!isUserProfile(profile) || profile.avatarId !== avatarId) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({ nickname: profile.nickname, avatarId: profile.avatarId, sessionId: input.sessionId },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
