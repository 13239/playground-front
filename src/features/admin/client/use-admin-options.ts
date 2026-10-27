"use client";

import { useEffect, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import type { Page } from "../contracts";
import { useAdminScope } from "../components/admin-ui";
import { adminRequest, errorMessage } from "./api";

type SearchPage<T> = Readonly<{ key: string; items: readonly T[]; nextCursor: string | null; error?: string }>;

/** 검색을 짧게 지연하고 이전 검색·닫힌 선택기의 응답을 취소한다. 선택한 항목은 이 검색 상태와 분리한다. */
// 장르와 권한을 포함한 관리자 선택 목록이 요청 취소·중복 방지·커서 이어 읽기를 공유한다.
export function useAdminOptions<T extends { code: string }>(area: string, label: string, open: boolean, search: string, revision: number, limit = 20) {
  const { sessionId } = useAdminScope();
  const query = search.trim();
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<SearchPage<T>>();
  const [more, setMore] = useState<{ key: string; busy: boolean; error?: string }>();
  const running = useRef<AbortController | undefined>(undefined);
  // 검색 없는 권한 목록은 허용된 큰 묶음으로 읽어 개수가 늘어도 왕복 요청을 줄인다.
  const key = JSON.stringify([sessionId, area, query, revision, attempt, limit]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (query) params.set("query", query);
      void adminRequest<Page<T>>(sessionId, `${area}?${params}`, "GET", undefined, controller.signal)
        .then(result => { if (!controller.signal.aborted) setPage({ key, ...result }); })
        .catch(failure => { if (!controller.signal.aborted) setPage({ key, items: [], nextCursor: null, error: errorMessage(failure) }); });
    }, query ? 200 : 0);
    return () => {
      clearTimeout(timer); controller.abort();
      // 이전 이어 읽기의 종료 응답을 기다리지 않고 새 검색에서 필요한 요청을 바로 시작할 수 있게 한다.
      const previous = running.current; running.current = undefined; previous?.abort();
    };
  }, [open, sessionId, area, query, key, limit]);

  async function loadMore() {
    if (!open || running.current || page?.key !== key || !page.nextCursor) return;
    const controller = new AbortController(); running.current = controller; setMore({ key, busy: true });
    try {
      const params = new URLSearchParams({ limit: String(limit), cursor: page.nextCursor });
      if (query) params.set("query", query);
      const result = await adminRequest<Page<T>>(sessionId, `${area}?${params}`, "GET", undefined, controller.signal);
      controller.signal.throwIfAborted();
      if (result.nextCursor === page.nextCursor) throw new AuthRequestError(`${label} 목록을 이어서 불러올 수 없습니다. 다시 검색해 주세요.`, 502);
      setPage(current => current?.key === key ? { key,
        items: [...new Map([...current.items, ...result.items].map(item => [item.code, item])).values()], nextCursor: result.nextCursor } : current);
      setMore({ key, busy: false });
    } catch (failure) {
      if (!controller.signal.aborted) setMore({ key, busy: false, error: errorMessage(failure) });
    } finally { if (running.current === controller) running.current = undefined; }
  }

  return { key, items: page?.key === key ? page.items : [], loading: open && page?.key !== key,
    error: page?.key === key ? page.error : undefined, hasMore: page?.key === key && !!page.nextCursor,
    moreBusy: more?.key === key && more.busy, moreError: more?.key === key ? more.error : undefined,
    loadMore, retry: () => setAttempt(value => value + 1) };
}
