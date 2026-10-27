import "server-only";

import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { parseAdminGameFilter, parseFilterGrid } from "../filter-contracts";
import { parseGameFilterPage } from "@/features/games/filter-contracts";
import { gameCodePattern } from "@/features/games/contracts";
import { isCardLabelCodes } from "@/features/games/card-labels";
import { parseContext, parsePermissions, parseRole, parseRoleSummary, parsePolicy, parsePage, parseGame, parseMode, parseGenre, parseImplementations } from "../contracts";
import { isUserStatus, parseUserPage, parseUserDetails, parseSensitive, parseUserRole, parseNicknamePage, parseUserRoleOptions } from "../user-contracts";
import { parseActivityLogPage, parseAuditLogPage, parseActivityLogDetails, parseAuditLogDetails, parseLogOptions } from "../log-contracts";
import { isLogDate } from "../log-search";
import { parseAdminChatGames, parseAdminChatMessage, parseAdminChatPage } from "../chat-contracts";
import { parseDashboard, parseServiceStatuses } from "../monitoring-contracts";
import { parseCatalogOrderPage, parseCatalogOrderResult } from "../catalog-order-contracts";
import { parseGameGridPage, parseGenreGridPage, parseAdminGenre } from "../catalog-grid-contracts";
import { parseGenreOptionPage, MAX_GAME_GENRES } from "../genre-options-contracts";
import { parseNumberedPage } from "../pagination-contracts";

type Endpoint = Readonly<{ parse: (v: unknown) => unknown; fields?: readonly string[]; query?: "filter-grid" | "list" | "roles" | "delete" | "users" | "history" | "activity-logs" | "audit-logs" | "chat" | "dashboard" | "catalog-order" | "catalog-grid"; status?: 200 | 204 }>;
const roleFields = ["name", "description", "permissions", "reason"];
const availabilityFields = ["published", "availability", "message", "expectedVersion"];
// 수동 순서값은 일반 저장 경로에서 받지 않고 그리드 이동 요청으로만 변경한다.
const modeFields = ["name", "minHumanPlayers", "maxHumanPlayers", "expectedVersion"];
const genreFields = ["name", "enabled", "expectedVersion"];
const gameFields = ["metadata", "expectedVersion"];

/** 고정된 관리 기능만 전달한다. 임의 URL·메서드나 미래에 추가된 Spring API를 자동 공개하지 않는다. */
function endpoint(segments: readonly string[], method: string): Endpoint {
  const [area, code, sub, mode, action] = segments;
  // 공통 필터의 CRUD·순서·선택 조회만 기존 관리자 인증 경계에 공개한다.
  if (area === "game-filters") {
    if (code === "order" && segments.length === 2) {
      if (method === "GET") return { parse: parseCatalogOrderPage, query: "catalog-order" };
      if (method === "PUT") return { parse: parseCatalogOrderResult, fields: ["expectedVersion", "moves"] };
    }
    if (code === "options" && segments.length === 2 && method === "GET") return { parse: parseGameFilterPage, query: "list" };
    if (segments.length === 1 && method === "GET") return { parse: parseFilterGrid, query: "filter-grid" };
    if (segments.length === 2 && gameCodePattern.test(code)) {
      if (method === "GET") return { parse: parseAdminGameFilter };
      if (method === "POST" || method === "PUT") return { parse: parseAdminGameFilter, fields: ["name", "type", "icon", "enabled", "minPlayers", "maxPlayers", "graphicsType", "expectedVersion"] };
      if (method === "DELETE") return { parse: () => undefined, query: "delete", status: 204 };
    }
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  // 장르 선택기의 커서 조회는 관리 그리드의 번호 페이지 조회와 분리한다.
  if (area === "game-genres" && code === "options" && segments.length === 2 && method === "GET") {
    return { parse: parseGenreOptionPage, query: "list" };
  }
  // 운영 설정의 역할 선택기는 코드 커서를 유지하고 권한 관리 그리드만 번호 페이지로 조회한다.
  if (area === "roles" && code === "options" && segments.length === 2 && method === "GET") {
    return { parse: value => parsePage(value, parseRoleSummary, true), query: "roles" };
  }
  // 전체 순서 편집에는 검색·필터·커서를 전달하지 않으며 인증된 네 경로만 공개한다.
  if ((area === "games" || area === "game-genres") && code === "order" && segments.length === 2) {
    if (method === "GET") return { parse: parseCatalogOrderPage, query: "catalog-order" };
    if (method === "PUT") return { parse: parseCatalogOrderResult, fields: ["expectedVersion", "moves"] };
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  // 지표 기간과 고정 서비스 상태만 읽는다. 수집/진단/인프라 조작 경로는 공개하지 않는다.
  if (area === "dashboard" || area === "service-status") {
    if (segments.length !== 1 || method !== "GET") throw new ApiError("INVALID_REQUEST_BODY");
    return area === "dashboard" ? { parse: parseDashboard, query: "dashboard" } : { parse: parseServiceStatuses };
  }
  // 채팅 저장 내역은 GET 세 경로만 허용한다. ObjectId를 일반 게임·권한 코드로 해석하지 않는다.
  if (area === "chat") {
    if (method !== "GET") throw new ApiError("INVALID_REQUEST_BODY");
    if (segments.length === 2 && code === "games") return { parse: parseAdminChatGames };
    if (segments.length === 2 && code === "messages") return { parse: parseAdminChatPage, query: "chat" };
    if (segments.length === 3 && code === "messages" && /^[a-f0-9]{24}$/.test(sub)) return { parse: parseAdminChatMessage };
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  // 로그는 두 종류의 GET만 공개한다. 원문 JSON·수정·삭제 경로를 전달하지 않는다.
  if (area === "logs") {
    if (method !== "GET" || (code !== "activities" && code !== "audits")) throw new ApiError("INVALID_REQUEST_BODY");
    if (segments.length === 2) return { parse: code === "activities" ? parseActivityLogPage : parseAuditLogPage, query: code === "activities" ? "activity-logs" : "audit-logs" };
    if (segments.length === 3 && sub === "options") return { parse: parseLogOptions };
    if (segments.length === 3 && /^[1-9]\d{0,15}$/.test(sub) && Number.isSafeInteger(Number(sub))) return { parse: code === "activities" ? parseActivityLogDetails : parseAuditLogDetails };
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  // 회원 ID는 정규 양의 정수만 허용한다. 임의 필드나 관리자 닉네임 변경 API는 공개하지 않는다.
  if (area === "users") {
    if (segments.length === 1 && method === "GET") return {parse:parseUserPage,query:"users"};
    if (segments.length === 2 && code === "role-options" && method === "GET") return {parse:parseUserRoleOptions,query:"roles"};
    if (!code || !/^[1-9]\d{0,15}$/.test(code) || !Number.isSafeInteger(Number(code))) throw new ApiError("INVALID_REQUEST_BODY");
    if (segments.length === 2 && method === "GET") return {parse:parseUserDetails};
    if (segments.length === 3) {
      if (sub === "nickname-history" && method === "GET") return {parse:parseNicknamePage,query:"history"};
      if (sub === "sensitive" && method === "GET") return {parse:parseSensitive};
      if (sub === "status" && method === "PUT") return {parse:parseUserDetails,fields:["status","expectedVersion","reason"]};
      if (sub === "role" && method === "GET") return {parse:parseUserRole};
      if (sub === "role" && method === "PUT") return {parse:parseUserRole,fields:["roleCode","expectedVersion","reason"]};
    }
    if (segments.length === 4 && sub === "sessions" && mode === "revoke" && method === "POST") return {parse:()=>undefined,fields:["expectedVersion","reason"],status:204};
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  if (segments.length > 5 || segments.some(s => !/^[a-z-]+$/.test(s) && !gameCodePattern.test(s))) throw new ApiError("INVALID_REQUEST_BODY");
  if (segments.length === 1 && method === "GET") {
    if (area === "me") return { parse: parseContext };
    if (area === "permissions") return { parse: parsePermissions };
    if (area === "roles") return { parse: value => parseNumberedPage(value, parseRoleSummary), query: "catalog-grid" };
    if (area === "access-policy") return { parse: parsePolicy };
    if (area === "games") return { parse: parseGameGridPage, query: "catalog-grid" };
    if (area === "game-genres") return { parse: parseGenreGridPage, query: "catalog-grid" };
    if (area === "game-implementations") return { parse: parseImplementations };
  }
  if (area === "roles") {
    if (segments.length === 1 && method === "POST") return { parse: parseRole, fields: ["code", ...roleFields] };
    if (segments.length === 2 && gameCodePattern.test(code)) {
      if (method === "GET") return { parse: parseRole };
      if (method === "PUT") return { parse: parseRole, fields: [...roleFields, "expectedVersion"] };
      if (method === "DELETE") return { parse: () => undefined, query: "delete" };
    }
  }
  if (area === "access-policy" && method === "PUT") {
    if (segments.length === 1) return { parse: parsePolicy, fields: ["enabled", "message", "expectedVersion", "reason"] };
    if (segments.length === 2 && code === "exemptions") return { parse: parsePolicy, fields: ["roleCodes", "expectedVersion", "reason"] };
  }
  if (area === "games") {
    if (segments.length === 1 && method === "POST") return { parse: parseGame, fields: ["code", "metadata"] };
    if (code && gameCodePattern.test(code)) {
      if (segments.length === 2 && method === "GET") return { parse: parseGame };
      if (segments.length === 2 && method === "PUT") return { parse: parseGame, fields: gameFields };
      if (segments.length === 3 && sub === "availability" && method === "PUT") return { parse: parseGame, fields: availabilityFields };
      if (sub === "modes" && mode && gameCodePattern.test(mode)) {
        if (segments.length === 4 && (method === "POST" || method === "PUT")) return { parse: parseMode, fields: modeFields };
        if (segments.length === 5 && action === "availability" && method === "PUT") return { parse: parseMode, fields: availabilityFields };
      }
    }
  }
  if (area === "game-genres" && segments.length === 2 && gameCodePattern.test(code) && (method === "POST" || method === "PUT")) return { parse: parseGenre, fields: genreFields };
  if (area === "game-genres" && segments.length === 2 && gameCodePattern.test(code) && method === "GET") return { parse: parseAdminGenre };
  throw new ApiError("INVALID_REQUEST_BODY");
}

function assertFields(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).some(k => !fields.includes(k))) throw new ApiError("INVALID_REQUEST_BODY");
}
/** 쿼리 중복·미등록 조건은 거절하고 서명한 인코딩/순서를 그대로 상위 서버에 전달한다. */
function validateQuery(url: URL, kind: Endpoint["query"]): void {
  const keys = [...url.searchParams.keys()];
  const allowed = kind === "filter-grid" ? ["query", "type", "enabled", "page", "size"] : kind === "catalog-grid" ? ["query", "page", "size"] : kind === "catalog-order" ? ["page", "size"] : kind === "dashboard" ? ["period"] : kind === "chat" ? ["from","to","query","scope","gameCode","roomId","page","size"] : kind === "delete" ? ["expectedVersion"] : kind === "users" ? ["query","page","size","status","roleCode"] : kind === "history" ? ["page","size"]
    : kind === "activity-logs" ? ["from","to","query","type","result","page","size"]
      : kind === "audit-logs" ? ["from","to","query","action","targetType","page","size"] : kind ? ["query", "cursor", "limit"] : [];
  if (new Set(keys).size !== keys.length || keys.some(k => !allowed.includes(k))) throw new ApiError("INVALID_REQUEST_BODY");
  for (const [key, value] of url.searchParams) {
    if (key === "query" && value.length > 100 || key === "limit" && !/^(?:[1-9]|[1-9]\d|100)$/.test(value)
      || key === "expectedVersion" && (!/^\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)))
      // 탈퇴 검색도 실제 계정 상태 코드만 허용하고 이전 삭제 전용 검색값은 전달하지 않는다.
      || key === "status" && !isUserStatus(value)
      || key === "roleCode" && !gameCodePattern.test(value)
      || key === "period" && !["TODAY", "WEEK", "MONTH"].includes(value)
      || key === "scope" && !["GLOBAL", "GAME_ROOM"].includes(value)
      || key === "gameCode" && !gameCodePattern.test(value)
      || key === "roomId" && (!/^[1-9]\d{0,15}$/.test(value) || !Number.isSafeInteger(Number(value)))
      || (key === "from" || key === "to") && !isLogDate(value)
      || key === "type" && !/^[A-Z][A-Z0-9_]{0,39}$/.test(value)
      || key === "result" && !["SUCCESS", "FAILURE"].includes(value)
      || key === "action" && !/^[A-Z][A-Z0-9_]{0,63}$/.test(value)
      || key === "targetType" && !/^[A-Z][A-Z0-9_]{0,31}$/.test(value)
      // 권한/회원/이력/로그는 양의 페이지 번호와 네 가지 표시 개수만 전달한다.
      || key === "page" && (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647)
      || key === "enabled" && !["true", "false"].includes(value)
      || key === "type" && kind === "filter-grid" && !["GENRE", "PLAYERS", "GRAPHICS"].includes(value)
      // 닉네임 이력의 15개 표시를 허용하되 다른 관리 목록의 기존 개수 제한은 유지한다.
      || key === "size" && !(kind === "history" ? /^(?:10|15|20|30)$/ : kind === "filter-grid" ? /^(?:20|30|40|50)$/ : kind === "catalog-order" ? /^(?:10|20|30|40|50)$/ : /^(?:10|20|30|50)$/).test(value)
      || key === "cursor" && !(kind === "roles" ? gameCodePattern : kind === "users" || kind === "history" ? /^[1-9]\d{0,18}$/ : /^\d{1,7}:\d{1,19}$/).test(value)) throw new ApiError("INVALID_REQUEST_BODY");
  }
  if (kind === "delete" && !url.searchParams.has("expectedVersion")) throw new ApiError("INVALID_REQUEST_BODY");
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  if (from && to && from > to) throw new ApiError("INVALID_REQUEST_BODY");
  if (kind === "chat" && url.searchParams.get("scope") === "GLOBAL" && (url.searchParams.has("gameCode") || url.searchParams.has("roomId"))) throw new ApiError("INVALID_REQUEST_BODY");
}

export async function handleAdminRequest(request: Request, segments: readonly string[]): Promise<Response> {
  try {
    assertSameOrigin(request);
    const spec = endpoint(segments, request.method);
    const url = new URL(request.url);
    validateQuery(url, spec.query);
    const sessionId = request.headers.get("X-Expected-Session-ID");
    if (!isSessionId(sessionId)) throw new ApiError("INVALID_REQUEST_BODY");
    const proof = await readBrowserProof(request.clone());
    let body: Record<string, unknown> | undefined;
    if (spec.fields) {
      // 최대 장르 연결·카드 라벨·한글 설명을 함께 저장할 수 있게 게임 정보만 32KiB까지 허용한다.
      const input = await readJsonBody(request, spec.fields.includes("metadata") ? 32768 : 16384);
      assertFields(input, spec.fields);
      // 계정 상태·강제 로그아웃 사유는 UI를 우회해도 누락·공백·초과 길이를 거절한다. 서명된 본문 값은 변경하지 않는다.
      if (segments[0] === "users" && (segments.length === 3 && segments[2] === "status"
        || segments.length === 4 && segments[2] === "sessions" && segments[3] === "revoke")
        && (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 300)) throw new ApiError("INVALID_REQUEST_BODY");
      if ("metadata" in input) {
        assertFields(input.metadata, ["name", "summary", "description", "genreCodes", "cardLabelCodes"]);
        const codes = input.metadata.genreCodes;
        // 폐기한 이미지·사유 필드를 전달하지 않고 장르 코드의 크기·문법·중복도 여기서 제한한다.
        if (!Array.isArray(codes) || codes.length > MAX_GAME_GENRES || new Set(codes).size !== codes.length
          || codes.some(code => typeof code !== "string" || !gameCodePattern.test(code))) throw new ApiError("INVALID_REQUEST_BODY");
        // 카드 라벨도 크기·형식·중복을 먼저 검사하고 실제 장르·모드와의 일치는 Spring이 검증한다.
        if (!isCardLabelCodes(input.metadata.cardLabelCodes)) throw new ApiError("INVALID_REQUEST_BODY");
      }
      // 중첩 이동 항목에도 허용 필드·개수·코드 문법을 적용해 임의 정렬값이나 대량 본문을 전달하지 않는다.
      if ("moves" in input) {
        if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 0
          || !Array.isArray(input.moves) || input.moves.length < 1 || input.moves.length > 100) throw new ApiError("INVALID_REQUEST_BODY");
        for (const move of input.moves) {
          assertFields(move, ["code", "beforeCode"]);
          if (typeof move.code !== "string" || !gameCodePattern.test(move.code)
            || move.beforeCode != null && (typeof move.beforeCode !== "string" || !gameCodePattern.test(move.beforeCode))
            || move.code === move.beforeCode) throw new ApiError("INVALID_REQUEST_BODY");
        }
        if (new Set(input.moves.map(move => move.code)).size !== input.moves.length) throw new ApiError("INVALID_REQUEST_BODY");
      }
      body = input;
    } else if (request.body !== null) {
      // Next의 DELETE는 본문이 없어도 빈 스트림을 제공할 수 있다. 실제 바이트가 있는 요청만 거절한다.
      const reader = request.body.getReader();
      try {
        while (true) { const { done, value } = await reader.read(); if (value?.byteLength) throw new ApiError("INVALID_REQUEST_BODY"); if (done) break; }
      } finally { await reader.cancel(); reader.releaseLock(); }
    }
    const path = `/api/admin/${segments.join("/")}${url.search}` as const;
    const value = await withAuthenticatedSession(proof, (accessToken, proof) => backendRequest(path, {
      method: request.method as "GET" | "POST" | "PUT" | "DELETE", accessToken, proof, body, signal: request.signal,
    }), sessionId);
    if (request.method === "DELETE" || spec.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
    let result: unknown;
    try {
      result = spec.parse(value);
      // 다른 기간의 응답을 현재 차트에 잘못 표시하지 않는다. 기간은 이미 검증된 응답 계약에서 읽는다.
      if (segments.length === 1 && segments[0] === "dashboard" && (result as { period: string }).period !== (url.searchParams.get("period") ?? "TODAY")) throw new Error("Dashboard period mismatch");
    } catch { throw new ApiError("INVALID_BACKEND_RESPONSE"); }
    return Response.json(result, { status: spec.status ?? (request.method === "POST" ? 201 : 200),
      headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, X-Expected-Session-ID" } });
  } catch (error) {
    // 헤더의 관리자 진입 확인에서 권한 없음은 정상 조회 결과다. 검증된 ACCESS_DENIED만 200/null로 공개한다.
    // 실제 관리 API의 접근 거부와 로그인 만료·브라우저 증명 실패는 각 오류 상태를 유지한다.
    if (request.method === "GET" && segments.length === 1 && segments[0] === "me"
      && error instanceof ApiError && error.code === "ACCESS_DENIED") {
      return Response.json(null, {
        headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, X-Expected-Session-ID" },
      });
    }
    return apiErrorResponse(error);
  }
}
