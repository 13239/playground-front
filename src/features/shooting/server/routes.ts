import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { isTicket, isOverview, isShootingRooms } from "../contracts";
import { getShootingEndpoint } from "./config";

/** 참가권·순위·공개 방 조회만 브라우저에 열고 기록과 대기실 갱신은 내부 경로로 제한한다. */
export async function handleShooting(
  request: Request,
  operation: "ticket" | "overview" | "rooms",
) {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 2048);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new ApiError("INVALID_REQUEST_BODY");
    const value = input as Record<string, unknown>;
    const allowed =
      operation === "rooms"
        ? ["sessionId", "page", "search", "friendsOnly"]
        : operation === "ticket"
          ? ["sessionId", "mode", "invitedRoomCode"]
          : ["sessionId", "mode", "page"];
    if (
      !isSessionId(value.sessionId) ||
      (operation !== "rooms" &&
        !["SINGLE", "COOP"].includes(String(value.mode))) ||
      Object.keys(value).some((key) => !allowed.includes(key)) ||
      // 코드·초대 입장은 서버가 특정 협동 방에 묶인 티켓으로 검증한다.
      (operation === "ticket" && value.invitedRoomCode !== undefined &&
        (value.mode !== "COOP" || typeof value.invitedRoomCode !== "string" || !/^[A-Z2-9]{8}$/.test(value.invitedRoomCode))) ||
      (operation === "overview" &&
        (!Number.isSafeInteger(value.page) ||
          Number(value.page) < 1 ||
          Number(value.page) > 10)) ||
      (operation === "rooms" &&
        (!Number.isSafeInteger(value.page) ||
          Number(value.page) < 1 ||
          Number(value.page) > 10000 ||
          typeof value.search !== "string" ||
          value.search.length > 50 ||
          typeof value.friendsOnly !== "boolean"))
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    const { sessionId, ...body } = value;
    const result = await withAuthenticatedSession(
      proof,
      (accessToken, signedProof) =>
        backendRequest(`/api/shooting/${operation}`, {
          method: "POST",
          accessToken,
          proof: signedProof,
          body,
        }),
      sessionId,
    );
    if (operation === "ticket") {
      if (
        !isTicket(result) ||
        result.endpoint.replace(/\/$/, "") !== getShootingEndpoint()
      )
        throw new ApiError("INVALID_BACKEND_RESPONSE");
    } else if (
      operation === "rooms" ? !isShootingRooms(result) : !isOverview(result)
    )
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(
      { ...(result as object), sessionId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
