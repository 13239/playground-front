import "server-only";
import { backendRequest } from "@/lib/server/backend-client";
import { ApiError } from "@/lib/server/api-error";
import { gameCodePattern, isCatalogPage, isGenrePage, publicGame } from "../contracts";

/** 공개 검색은 허용된 작은 조건만 재구성한다. 요청 URL·헤더를 그대로 백엔드에 전달하지 않는다. */
export async function catalogResponse(request: Request, genres = false): Promise<Response> {
  const input = new URL(request.url).searchParams;
  const allowed = genres ? ["query", "cursor", "limit"] : ["query", "genre", "graphics", "players", "humanPlayers", "newOnly", "cursor", "limit"];
  const params = new URLSearchParams();
  for (const key of input.keys()) if (!allowed.includes(key) || input.getAll(key).length !== 1) throw new ApiError("INVALID_REQUEST_BODY");
  for (const [key, value] of input) {
    const valid = key === "query" ? value.length <= 100 : key === "cursor" ? /^\d{1,7}:\d{1,19}$/.test(value)
      : key === "genre" ? gameCodePattern.test(value) : key === "graphics" ? ["TWO_D", "THREE_D"].includes(value)
      : key === "players" ? ["SINGLE", "TWO", "GROUP", "MULTIPLAYER"].includes(value)
      : key === "newOnly" ? ["true", "false"].includes(value)
      : /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= (key === "limit" ? 100 : 10000);
    if (!valid) throw new ApiError("INVALID_REQUEST_BODY");
    params.set(key, value);
  }
  const result = await backendRequest(`/api/${genres ? "game-genres" : "games"}${params.size ? `?${params}` : ""}`, { signal: request.signal });
  if (genres) {
    if (!isGenrePage(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({ items: result.items.map(genre => ({ code: genre.code, name: genre.name, sortOrder: genre.sortOrder })), nextCursor: result.nextCursor }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!isCatalogPage(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
  return Response.json({ items: result.items.map(publicGame), nextCursor: result.nextCursor }, { headers: { "Cache-Control": "no-store" } });
}
