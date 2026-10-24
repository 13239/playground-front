"use client";

import { requestAdminApi, AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession } from "@/features/auth/client/session-store";

/** 화면은 토큰을 다루지 않는다. BFF와 Spring이 세션·입력·권한을 검증한 응답만 받는다. */
export async function adminRequest<T>(sessionId: string, path: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  try {
    const response = await requestAdminApi(`/api/admin/${path}`, sessionId, method, body, signal);
    return response.status === 204 ? undefined as T : await response.json() as T;
  } catch (error) {
    if (error instanceof AuthRequestError && (error.status === 401 || error.code === "LOGIN_SESSION_CHANGED")) revalidateAuthSession();
    throw error;
  }
}
export const errorMessage = (error: unknown) => error instanceof AuthRequestError ? error.message : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export function listPath(area: string, query: string, cursor?: string): string {
  const search = new URLSearchParams({ limit: "50" });
  if (query.trim()) search.set("query", query.trim());
  if (cursor) search.set("cursor", cursor);
  return `${area}?${search}`;
}
