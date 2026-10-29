import {
  requestAuthenticatedApi,
  AuthRequestError,
} from "@/features/auth/client/api";
import {
  isOverview,
  isTicket,
  isShootingRooms,
  type ShootingRooms,
  type ShootingOverview,
  type ShootingTicket,
} from "../contracts";
import type { Mode } from "@playground/shooting-shared";

/** 목록 갱신도 기존 로그인 세션과 취소 신호를 공유하며 이전 계정 응답을 거절한다. */
export async function readShootingRooms(
  sessionId: string,
  page: number,
  search: string,
  friendsOnly: boolean,
  signal?: AbortSignal,
): Promise<ShootingRooms> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/rooms",
    { sessionId, page, search, friendsOnly },
    signal,
  );
  const value: unknown = await response.json();
  if (!isShootingRooms(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("방 목록을 확인하지 못했습니다.", 502);
  return value;
}

/** 공통 요청 증명·세션 갱신을 재사용하며 다른 계정의 지연된 응답을 표시하지 않는다. */
export async function issueTicket(
  sessionId: string,
  mode: Mode,
  signal?: AbortSignal,
): Promise<ShootingTicket> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/ticket",
    { sessionId, mode },
    signal,
  );
  const value: unknown = await response.json();
  if (!isTicket(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("게임 접속 응답을 확인하지 못했습니다.", 502);
  return value;
}
export async function readRankings(
  sessionId: string,
  mode: Mode,
  page = 1,
  signal?: AbortSignal,
): Promise<ShootingOverview> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/overview",
    { sessionId, mode, page },
    signal,
  );
  const value: unknown = await response.json();
  if (!isOverview(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("게임 순위를 확인하지 못했습니다.", 502);
  return value;
}
