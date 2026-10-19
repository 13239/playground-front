import "server-only";

import type { CurrentSession } from "../types";
import { getSessionFromBackend } from "./api";
import { readAuthCookie } from "./cookies";
import { ApiError } from "@/lib/server/api-error";

/** 쿠키의 존재가 아닌 매 요청의 Spring JWT·Redis 검증으로 현재 세션을 확인한다. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await readAuthCookie();
  if (!session) return null;
  // Server Component에서는 쿠키를 변경하지 않고 브라우저의 POST 갱신 경계로 넘긴다.
  if (session.accessTokenExpiresAt <= Date.now()) throw new ApiError("SESSION_REFRESH_REQUIRED");
  try {
    return await getSessionFromBackend(session.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.code === "INVALID_ACCESS_TOKEN") {
      throw new ApiError("SESSION_REFRESH_REQUIRED");
    }
    if (error instanceof ApiError && error.status === 401) return null;
    // Redis 장애·시간 초과를 로그아웃으로 오인하지 않도록 호출자에게 구분해 전달한다.
    throw error;
  }
}
