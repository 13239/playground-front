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
import { inviteCodePattern } from "../contracts";
import { isWaitingRoom, publicWaitingRoom } from "../waiting-contracts";

type Operation = "search" | "create" | "close" | "join" | "state" | "ready" | "leave" | "lifecycle";
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
  join: ["sessionId", "roomId", "inviteCode", "password"],
  state: ["sessionId", "roomId", "pageId"],
  ready: ["sessionId", "roomId", "ready", "pageId"],
  leave: ["sessionId", "roomId", "membershipId", "pageId"],
  lifecycle: ["sessionId", "roomId", "membershipId", "pageId", "tabId", "action"],
};

/** 검색 조건도 서명 본문에 묶는다. 동일 Origin·화면의 세션을 확인하고 명시한 방 관리·대기실 경로만 호출한다. */
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
    } else if (operation === "join") {
      const byId = typeof input.roomId === "number" && Number.isSafeInteger(input.roomId) && input.roomId > 0;
      const byCode = typeof input.inviteCode === "string" && inviteCodePattern.test(input.inviteCode);
      if (byId === byCode || input.roomId !== undefined && !byId || input.inviteCode !== undefined && !byCode
        || input.password !== undefined && (typeof input.password !== "string" || !/^[A-Za-z0-9]{4,8}$/.test(input.password))) {
        throw new ApiError("INVALID_REQUEST_BODY");
      }
      body = { ...(byId ? { roomId: input.roomId } : { inviteCode: input.inviteCode }), password: input.password ?? null };
    } else {
      if (
        typeof input.roomId !== "number" ||
        !Number.isSafeInteger(input.roomId) ||
        input.roomId <= 0
      )
        throw new ApiError("INVALID_REQUEST_BODY");
      if (operation === "ready" && typeof input.ready !== "boolean") throw new ApiError("INVALID_REQUEST_BODY");
      // 최초 상태 조회만 페이지 식별자가 없을 수 있다. 연결 후 조회는 UUID로 참가 소유권을 확인한다.
      if (operation === "state" && input.pageId !== undefined
        && (typeof input.pageId !== "string" || !requestIdPattern.test(input.pageId))) throw new ApiError("INVALID_REQUEST_BODY");
      // 대국 상태를 변경하는 요청은 실제 페이지 식별자까지 브라우저 증명에 결합한다.
      if (["ready", "leave", "lifecycle"].includes(operation)
        && (typeof input.pageId !== "string" || !requestIdPattern.test(input.pageId))) throw new ApiError("INVALID_REQUEST_BODY");
      // 참가·페이지 범위를 본문 증명에 함께 결합해 이전 화면의 늦은 퇴장과 재입장을 구분한다.
      if ((operation === "leave" || operation === "lifecycle")
        && (typeof input.membershipId !== "string" || !requestIdPattern.test(input.membershipId))) throw new ApiError("INVALID_REQUEST_BODY");
      if (operation === "lifecycle" && (typeof input.tabId !== "string" || !requestIdPattern.test(input.tabId)
        || !["OPEN", "CLOSE", "LEAVE"].includes(input.action as string))) throw new ApiError("INVALID_REQUEST_BODY");
      body = { roomId: input.roomId, ...(operation === "ready" ? { ready: input.ready } : {}),
        ...((operation === "leave" || operation === "lifecycle") ? { membershipId: input.membershipId } : {}),
        ...(["ready", "leave", "lifecycle"].includes(operation) || operation === "state" && input.pageId !== undefined ? { pageId: input.pageId } : {}),
        ...(operation === "lifecycle" ? { tabId: input.tabId, action: input.action } : {}) };
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
          ...((operation === "close" || operation === "leave" || operation === "lifecycle") && { responseType: "empty" }),
        }),
      input.sessionId,
    );
    if (operation === "close" || operation === "leave" || operation === "lifecycle")
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
    // 대기실 스냅샷도 외부 필드를 그대로 재공개하지 않고 실제 계약을 검증한다.
    if (operation !== "search") {
      if (!isWaitingRoom(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
      return Response.json({ ...publicWaitingRoom(result), sessionId: input.sessionId },
        { headers: { "Cache-Control": "private, no-store" } });
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
