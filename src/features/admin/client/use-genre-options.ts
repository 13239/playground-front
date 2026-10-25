"use client";

import { useEffect, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import type { GenreOption, GenreOptionPage } from "../genre-options-contracts";
import { useAdminScope } from "../components/admin-ui";
import { adminRequest, errorMessage } from "./api";

type SearchPage = Readonly<{ key: string; items: readonly GenreOption[]; nextCursor: string | null; error?: string }>;

/** 검색을 짧게 지연하고 이전 검색·닫힌 선택기의 응답을 취소한다. 선택한 장르는 이 검색 상태와 분리한다. */
export function useGenreOptions(open: boolean, search: string, revision: number) {
  const { sessionId } = useAdminScope();
  const query = search.trim();
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<SearchPage>();
  const [more, setMore] = useState<{ key: string; busy: boolean; error?: string }>();
  const running = useRef<AbortController | undefined>(undefined);
  const key = JSON.stringify([sessionId, query, revision, attempt]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: "20" });
      if (query) params.set("query", query);
      void adminRequest<GenreOptionPage>(sessionId, `game-genres/options?${params}`, "GET", undefined, controller.signal)
        .then(result => { if (!controller.signal.aborted) setPage({ key, ...result }); })
        .catch(failure => { if (!controller.signal.aborted) setPage({ key, items: [], nextCursor: null, error: errorMessage(failure) }); });
    }, query ? 200 : 0);
    return () => {
      clearTimeout(timer); controller.abort();
      // 이전 이어 읽기의 종료 응답을 기다리지 않고 새 검색에서 필요한 요청을 바로 시작할 수 있게 한다.
      const previous = running.current; running.current = undefined; previous?.abort();
    };
  }, [open, sessionId, query, key]);

  async function loadMore() {
    if (!open || running.current || page?.key !== key || !page.nextCursor) return;
    const controller = new AbortController(); running.current = controller; setMore({ key, busy: true });
    try {
      const params = new URLSearchParams({ limit: "20", cursor: page.nextCursor });
      if (query) params.set("query", query);
      const result = await adminRequest<GenreOptionPage>(sessionId, `game-genres/options?${params}`, "GET", undefined, controller.signal);
      controller.signal.throwIfAborted();
      if (result.nextCursor === page.nextCursor) throw new AuthRequestError("장르 목록을 이어서 불러올 수 없습니다. 다시 검색해 주세요.", 502);
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
