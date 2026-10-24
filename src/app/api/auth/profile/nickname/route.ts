import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { isUserProfile } from "@/features/profile/types";
import { nicknameError } from "@/features/profile/validation";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 원문 서명·Origin·화면의 세션을 검증하고 닉네임만 변경한다. 아바타는 서버의 최신 값을 보존한다. */
export async function PUT(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 512);
    if (typeof input !== "object" || input === null || !("sessionId" in input) || !isSessionId(input.sessionId)
      || !("nickname" in input)) throw new ApiError("INVALID_REQUEST_BODY");
    const error = nicknameError(input.nickname);
    if (error) throw new ApiError("VALIDATION_FAILED", { fieldErrors: { nickname: error } });
    const nickname = input.nickname as string;
    const profile = await withAuthenticatedSession(proof, (accessToken, proof) => backendRequest("/api/auth/profile/nickname", {
      method: "PUT", body: { nickname }, accessToken, proof,
    }), input.sessionId);
    if (!isUserProfile(profile) || profile.nickname !== nickname) throw new ApiError("INVALID_BACKEND_RESPONSE");
    // 백엔드가 필드를 확장해도 공개한 닉네임·캐릭터 외의 정보는 브라우저에 전달하지 않는다.
    return Response.json({ nickname: profile.nickname, avatarId: profile.avatarId, sessionId: input.sessionId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
