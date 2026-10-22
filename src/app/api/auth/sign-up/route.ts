import { validateSignUpInput } from "@/features/auth/sign-up-validation";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { getClientUserAgent } from "@/lib/server/client-user-agent";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 공개 가입은 동일 Origin의 작은 JSON만 받고 세 항목만 전달한다. 쿠키·토큰이나 선택 개인정보는 발급·변경하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const result = validateSignUpInput(await readJsonBody(request));
    if (!result.valid) throw new ApiError("VALIDATION_FAILED", { fieldErrors: result.errors });
    await backendRequest("/api/user/sign-up", {
      method: "POST", body: result.input, clientIp: getTrustedClientIp(request), userAgent: getClientUserAgent(request), responseType: "empty",
    });
    return new Response(null, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
