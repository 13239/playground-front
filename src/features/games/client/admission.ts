import { AuthRequestError, requestAuthenticatedApi } from "@/features/auth/client/api";
import { gameCodePattern, isCatalogMode } from "../contracts";

/** 입장 확인은 새 실행마다 수행하고 조회 결과를 장기 이용권처럼 캐시하지 않는다. */
export async function admitGame(game: string, mode: string, sessionId: string, signal?: AbortSignal): Promise<void> {
  if (!gameCodePattern.test(game) || !gameCodePattern.test(mode)) throw new AuthRequestError("게임 정보를 확인할 수 없습니다.", 400);
  const response = await requestAuthenticatedApi(`/api/games/${game}/modes/${mode}/admission`, { sessionId }, signal);
  const result: unknown = await response.json();
  if (!isCatalogMode(result) || result.code !== mode || !result.supported || !result.published || result.availability !== "AVAILABLE") {
    throw new AuthRequestError("게임 시작 정보를 확인할 수 없습니다.", 502);
  }
}
