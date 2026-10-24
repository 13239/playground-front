import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { validatePasswordChange, type PasswordChangeInput } from "@/features/auth/password-validation";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 본인 비밀번호만 변경하며 인증 쿠키·현재 세션의 만료 시각은 유지한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 1024);
    if (typeof input !== "object" || input === null || !("sessionId" in input) || !isSessionId(input.sessionId)) {
      throw new ApiError("INVALID_REQUEST_BODY");
    }
    const fieldErrors = validatePasswordChange(input);
    if (Object.keys(fieldErrors).length) throw new ApiError("VALIDATION_FAILED", { fieldErrors });
    const { currentPassword, newPassword } = input as PasswordChangeInput & { sessionId: string };
    await withAuthenticatedSession(proof, (accessToken, proof) => backendRequest("/api/auth/password", {
      method: "POST", body: { currentPassword, newPassword }, accessToken, proof, responseType: "empty",
    }), input.sessionId);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
