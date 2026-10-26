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
  isJoinedRoom,
  isObject,
  isRoomPage,
  isRoomSummary,
  membershipIdPattern,
  publicHostedRoom,
  publicRoomPage,
  requestIdPattern,
  validateRoomDraft,
} from "../contracts";
import { inviteCodePattern } from "../contracts";
import { isJoinRoomReceipt, isWaitingRoom, publicWaitingRoom } from "../waiting-contracts";

type Operation = "search" | "create" | "settings" | "close" | "join" | "state" | "ready" | "kick" | "leave" | "lifecycle";
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
  // 설정·편집 당시 순서·현재 페이지를 모두 같은 서명 본문으로 전달한다.
  settings: ["sessionId", "roomId", "revision", "pageId", "title", "visibility", "password", "undoLimit", "forbiddenRule"],
  join: ["sessionId", "roomId", "inviteCode", "password"],
  state: ["sessionId", "roomId", "pageId"],
  ready: ["sessionId", "roomId", "ready", "pageId"],
  kick: ["sessionId", "roomId", "seat", "revision", "pageId", "blockRejoin"],
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
    } else if (operation === "create" || operation === "settings") {
      if (operation === "create" && (typeof input.requestId !== "string" || !requestIdPattern.test(input.requestId))) {
        throw new ApiError("INVALID_REQUEST_BODY");
      }
      // 현재 비공개 방만 비밀번호를 유지할 수 있는지는 Spring의 잠금 안에서 결정한다.
      if (operation === "settings" && (typeof input.roomId !== "number" || !Number.isSafeInteger(input.roomId) || input.roomId <= 0
        || typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 0
        || typeof input.pageId !== "string" || !requestIdPattern.test(input.pageId))) throw new ApiError("INVALID_REQUEST_BODY");
      const errors = validateRoomDraft(input, operation === "settings");
      if (Object.keys(errors).length)
        throw new ApiError("VALIDATION_FAILED", { fieldErrors: errors });
      body = {
        ...(operation === "create" ? { requestId: input.requestId }
          : { roomId: input.roomId, revision: input.revision, pageId: input.pageId }),
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
      // 선택 좌석·조회 버전·강퇴 정책을 함께 검증해 오래된 UI나 누락된 선택을 서버에 전달하지 않는다.
      if (operation === "kick" && (![1, 2].includes(input.seat as number) || typeof input.revision !== "number"
        || !Number.isSafeInteger(input.revision) || input.revision < 0
        || typeof input.blockRejoin !== "boolean")) throw new ApiError("INVALID_REQUEST_BODY");
      // 최초 상태 조회만 페이지 식별자가 없을 수 있다. 연결 후 조회는 UUID로 참가 소유권을 확인한다.
      if (operation === "state" && input.pageId !== undefined
        && (typeof input.pageId !== "string" || !requestIdPattern.test(input.pageId))) throw new ApiError("INVALID_REQUEST_BODY");
      // 대국 상태를 변경하는 요청은 실제 페이지 식별자까지 브라우저 증명에 결합한다.
      if (["ready", "kick", "leave", "lifecycle"].includes(operation)
        && (typeof input.pageId !== "string" || !requestIdPattern.test(input.pageId))) throw new ApiError("INVALID_REQUEST_BODY");
      // 참가·페이지 범위를 본문 증명에 함께 결합해 이전 화면의 늦은 퇴장과 재입장을 구분한다.
      // DB 이전으로 생성된 v1 참가 ID도 조회와 동일하게 허용하며 클라이언트 pageId·tabId는 계속 v4만 받는다.
      if ((operation === "leave" || operation === "lifecycle")
        && (typeof input.membershipId !== "string" || !membershipIdPattern.test(input.membershipId))) throw new ApiError("INVALID_REQUEST_BODY");
      if (operation === "lifecycle" && (typeof input.tabId !== "string" || !requestIdPattern.test(input.tabId)
        || !["OPEN", "CLOSE", "LEAVE"].includes(input.action as string))) throw new ApiError("INVALID_REQUEST_BODY");
      body = { roomId: input.roomId, ...(operation === "ready" ? { ready: input.ready } : {}),
        ...(operation === "kick" ? { seat: input.seat, revision: input.revision, blockRejoin: input.blockRejoin } : {}),
        ...((operation === "leave" || operation === "lifecycle") ? { membershipId: input.membershipId } : {}),
        ...(["ready", "kick", "leave", "lifecycle"].includes(operation) || operation === "state" && input.pageId !== undefined ? { pageId: input.pageId } : {}),
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
    // 참가 트랜잭션은 성공했는데 대기실 전체 스냅샷이 BFF의 복잡한 검증에 걸려 502가 나는 상황을 분리한다.
    // roomId 외의 Spring 내부 필드와 초대 코드는 클라이언트에 재전달하지 않는다.
    if (operation === "join") {
      if (!isJoinRoomReceipt(result)) {
        console.error("[gomoku] Invalid room join receipt", {
          keys: isObject(result) ? Object.keys(result).slice(0, 12) : [],
          roomIdType: isObject(result) ? typeof result.roomId : typeof result,
        });
        throw new ApiError("INVALID_BACKEND_RESPONSE");
      }
      return Response.json({ roomId: result.roomId, sessionId: input.sessionId },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    // 대기실 스냅샷도 외부 필드를 그대로 재공개하지 않고 실제 계약을 검증한다.
    if (operation !== "search") {
      if (!isWaitingRoom(result)) {
        console.error("[gomoku] Invalid room waiting response", {
          operation,
          keys: isObject(result) ? Object.keys(result).slice(0, 24) : [],
          participants: isObject(result) && Array.isArray(result.participants) ? result.participants.length : null,
          membershipIdType: isObject(result) ? typeof result.membershipId : typeof result,
          inviteCodeType: isObject(result) ? typeof result.inviteCode : typeof result,
        });
        throw new ApiError("INVALID_BACKEND_RESPONSE");
      }
      return Response.json({ ...publicWaitingRoom(result), sessionId: input.sessionId },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    // Jackson의 누락된 null 필드와 이전 버전의 복귀 메타데이터를 공개 계약으로 정규화한다.
    // 비방장 joinedRoom에 초대 코드나 내부 필드가 섞여 있어도 브라우저에 재전달하지 않는다.
    // id/title이 잘못됐거나 방 카드가 계약을 위반한 경우에는 계속 거부한다.
    const normalized = isObject(result)
      ? { ...result, hostedRoom: result.hostedRoom ?? null,
          joinedRoom: isObject(result.joinedRoom)
            ? { id: result.joinedRoom.id, title: result.joinedRoom.title }
            : result.joinedRoom ?? null }
      : result;
    if (!isRoomPage(normalized)) {
      // 내부 회원 정보나 초대 코드 등의 값은 로깅하지 않고 실패한 필드의 이름·형식만 남긴다.
      console.error("[gomoku] Invalid room search response", {
        keys: isObject(result) ? Object.keys(result).slice(0, 20) : [],
        roomCount: isObject(result) && Array.isArray(result.rooms) ? result.rooms.length : null,
        invalidRoomIndexes: isObject(result) && Array.isArray(result.rooms)
          ? result.rooms.flatMap((room, index) => isRoomSummary(room) ? [] : [index]).slice(0, 6) : [],
        page: isObject(result) ? typeof result.page : typeof result,
        pageSize: isObject(result) ? typeof result.pageSize : typeof result,
        totalElements: isObject(result) ? typeof result.totalElements : typeof result,
        totalPages: isObject(result) ? typeof result.totalPages : typeof result,
        hostedRoomValid: isObject(normalized) && (normalized.hostedRoom === null || isHostedRoom(normalized.hostedRoom)),
        joinedRoomValid: isObject(normalized) && (normalized.joinedRoom === null || isJoinedRoom(normalized.joinedRoom)),
      });
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    }
    return Response.json(
      { ...publicRoomPage(normalized), sessionId: input.sessionId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
