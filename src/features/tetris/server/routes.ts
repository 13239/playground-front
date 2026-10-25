import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { isOverview, isRun, uuid } from "../contracts";

/** 고정 경로·본문 상한·세션·Origin·본문 서명을 검증하며 서버가 계산한 공개 응답만 전달한다. */
export async function handleTetris(
  request: Request,
  operation: "overview" | "start" | "finish",
) {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(
      request,
      operation === "finish" ? 300_000 : 2048,
    );
    if (typeof input !== "object" || input === null || Array.isArray(input))
      throw new ApiError("INVALID_REQUEST_BODY");
    const value = input as Record<string, unknown>;
    const allowed =
      operation === "overview"
        ? ["sessionId", "page"]
        : operation === "start"
          ? ["sessionId", "requestId"]
          : ["sessionId", "runId", "ticks", "inputs"];
    if (
      !isSessionId(value.sessionId) ||
      Object.keys(value).some((key) => !allowed.includes(key))
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    if (
      (operation === "overview" &&
        (!Number.isSafeInteger(value.page) ||
          Number(value.page) < 1 ||
          Number(value.page) > 10)) ||
      (operation === "start" &&
        (typeof value.requestId !== "string" || !uuid.test(value.requestId)))
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    if (
      operation === "finish" &&
      (typeof value.runId !== "string" ||
        !uuid.test(value.runId) ||
        !Number.isSafeInteger(value.ticks) ||
        Number(value.ticks) < 1 ||
        Number(value.ticks) > 216000 ||
        !Array.isArray(value.inputs) ||
        value.inputs.length > 24000 ||
        !value.inputs.every(
          (item) =>
            Array.isArray(item) &&
            item.length === 2 &&
            Number.isSafeInteger(item[0]) &&
            item[0] >= 1 &&
            item[0] <= Number(value.ticks) &&
            Number.isSafeInteger(item[1]) &&
            item[1] >= 0 &&
            item[1] <= 6,
        ))
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    const { sessionId, ...body } = value;
    const result = await withAuthenticatedSession(
      proof,
      (accessToken, signedProof) =>
        backendRequest(`/api/tetris/${operation}`, {
          method: "POST",
          accessToken,
          proof: signedProof,
          body,
        }),
      sessionId,
    );
    if (operation === "start" ? !isRun(result) : !isOverview(result))
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(
      { ...(result as object), sessionId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
