import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import {
  isHostedRoom,
  isObject,
  isRoomPage,
  publicHostedRoom,
  publicRoomPage,
  requestIdPattern,
  validateRoomDraft,
} from "../contracts";

type Operation = "search" | "create" | "close";
const fields = {
  search: ["sessionId", "query", "publicOnly", "waitingOnly", "page"],
  create: [
    "sessionId",
    "requestId",
    "title",
    "visibility",
    "password",
    "undoLimit",
    "forbiddenRule",
  ],
  close: ["sessionId", "roomId"],
};

/** 검색 조건도 서명 본문에 묶는다. 동일 Origin·화면의 세션을 확인하고 고정된 세 가지 경로만 호출한다. */
export async function handleRoomRequest(
  request: Request,
  operation: Operation,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 2048);
    if (
      !isObject(input) ||
      !isSessionId(input.sessionId) ||
      Object.keys(input).some((key) => !fields[operation].includes(key))
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    let body: object;
    if (operation === "search") {
      if (
        typeof input.query !== "string" ||
        input.query.length > 30 ||
        typeof input.publicOnly !== "boolean" ||
        typeof input.waitingOnly !== "boolean" ||
        typeof input.page !== "number" ||
        !Number.isInteger(input.page) ||
        input.page < 0 ||
        input.page > 1000
      )
        throw new ApiError("INVALID_REQUEST_BODY");
      body = {
        query: input.query,
        publicOnly: input.publicOnly,
        waitingOnly: input.waitingOnly,
        page: input.page,
      };
    } else if (operation === "create") {
      if (
        typeof input.requestId !== "string" ||
        !requestIdPattern.test(input.requestId)
      )
        throw new ApiError("INVALID_REQUEST_BODY");
      const errors = validateRoomDraft(input);
      if (Object.keys(errors).length)
        throw new ApiError("VALIDATION_FAILED", { fieldErrors: errors });
      body = {
        requestId: input.requestId,
        title: input.title,
        visibility: input.visibility,
        password: input.password || null,
        undoLimit: input.undoLimit,
        forbiddenRule: input.forbiddenRule,
      };
    } else {
      if (
        typeof input.roomId !== "number" ||
        !Number.isSafeInteger(input.roomId) ||
        input.roomId <= 0
      )
        throw new ApiError("INVALID_REQUEST_BODY");
      body = { roomId: input.roomId };
    }
    const path =
      operation === "create"
        ? "/api/gomoku/rooms"
        : (`/api/gomoku/rooms/${operation}` as const);
    const result = await withAuthenticatedSession(
      proof,
      (accessToken, proof) =>
        backendRequest(path, {
          method: "POST",
          accessToken,
          proof,
          body,
          ...(operation === "close" && { responseType: "empty" }),
        }),
      input.sessionId,
    );
    if (operation === "close")
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "private, no-store" },
      });
    if (operation === "create") {
      if (!isHostedRoom(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
      return Response.json(
        { ...publicHostedRoom(result), sessionId: input.sessionId },
        { status: 201, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (!isRoomPage(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(
      { ...publicRoomPage(result), sessionId: input.sessionId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
