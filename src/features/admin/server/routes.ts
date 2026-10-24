import "server-only";

import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { gameCodePattern } from "@/features/games/contracts";
import { parseContext, parsePermissions, parseRole, parseRoleSummary, parsePolicy, parsePage, parseGame, parseMode, parseGenre, parseImplementations } from "../contracts";
import { parseUserPage, parseUserDetails, parseSensitive, parseUserRole, parseNicknamePage, parseUserRoleOptions } from "../user-contracts";

type Endpoint = Readonly<{ parse: (v: unknown) => unknown; fields?: readonly string[]; query?: "list" | "roles" | "delete" | "users" | "history"; status?: 200 | 204 }>;
const roleFields = ["name", "description", "permissions", "reason"];
const availabilityFields = ["published", "availability", "message", "expectedVersion", "reason"];
const modeFields = ["name", "minHumanPlayers", "maxHumanPlayers", "sortOrder", "expectedVersion", "reason"];
const genreFields = ["name", "enabled", "sortOrder", "expectedVersion", "reason"];
const gameFields = ["metadata", "expectedVersion", "reason"];

/** 고정된 관리 기능만 전달한다. 임의 URL·메서드나 미래에 추가된 Spring API를 자동 공개하지 않는다. */
function endpoint(segments: readonly string[], method: string): Endpoint {
  const [area, code, sub, mode, action] = segments;
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
    if (area === "roles") return { parse: v => parsePage(v, parseRoleSummary, true), query: "roles" };
    if (area === "access-policy") return { parse: parsePolicy };
    if (area === "games") return { parse: v => parsePage(v, parseGame), query: "list" };
    if (area === "game-genres") return { parse: v => parsePage(v, parseGenre), query: "list" };
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
    if (segments.length === 1 && method === "POST") return { parse: parseGame, fields: ["code", "metadata", "reason"] };
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
  throw new ApiError("INVALID_REQUEST_BODY");
}

function assertFields(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).some(k => !fields.includes(k))) throw new ApiError("INVALID_REQUEST_BODY");
}
/** 쿼리 중복·미등록 조건은 거절하고 서명한 인코딩/순서를 그대로 상위 서버에 전달한다. */
function validateQuery(url: URL, kind: Endpoint["query"]): void {
  const keys = [...url.searchParams.keys()];
  const allowed = kind === "delete" ? ["expectedVersion"] : kind === "users" ? ["query","page","size","status","roleCode"] : kind === "history" ? ["page","size"] : kind ? ["query", "cursor", "limit"] : [];
  if (new Set(keys).size !== keys.length || keys.some(k => !allowed.includes(k))) throw new ApiError("INVALID_REQUEST_BODY");
  for (const [key, value] of url.searchParams) {
    if (key === "query" && value.length > 100 || key === "limit" && !/^(?:[1-9]|[1-9]\d|100)$/.test(value)
      || key === "expectedVersion" && (!/^\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)))
      || key === "status" && !["ACTIVE","INACTIVE","PENDING","DELETED"].includes(value)
      || key === "roleCode" && !gameCodePattern.test(value)
      // 회원/이력은 양의 페이지 번호와 네 가지 표시 개수만 전달한다.
      || key === "page" && (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647)
      || key === "size" && !/^(?:10|20|30|50)$/.test(value)
      || key === "cursor" && !(kind === "roles" ? gameCodePattern : kind === "users" || kind === "history" ? /^[1-9]\d{0,18}$/ : /^\d{1,7}:\d{1,19}$/).test(value)) throw new ApiError("INVALID_REQUEST_BODY");
  }
  if (kind === "delete" && !url.searchParams.has("expectedVersion")) throw new ApiError("INVALID_REQUEST_BODY");
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
      const input = await readJsonBody(request, 16384);
      assertFields(input, spec.fields);
      if ("metadata" in input) assertFields(input.metadata, ["name", "summary", "description", "thumbnailKey", "genreCodes", "sortOrder"]);
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
    try { result = spec.parse(value); } catch { throw new ApiError("INVALID_BACKEND_RESPONSE"); }
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
