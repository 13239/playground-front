"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requireSuccess, AuthRequestError } from "@/features/auth/client/error";
import { isCatalogPage, type CatalogGame } from "../contracts";
import { parseGameFilterPage, type GameFilter } from "../filter-contracts";
import type { GameCategoryId } from "@/features/lobby/catalog";
import { useCatalogResume } from "./use-catalog-resume";

type Page = Readonly<{ key: string; items: readonly CatalogGame[]; nextCursor: string | null; error?: string }>;
function queryFor(category: GameCategoryId, search: string): string {
  const query = new URLSearchParams({ limit: "40" });
  if (search.trim()) query.set("query", search.trim());
  if (category === "new") query.set("newOnly", "true");
  if (category.startsWith("filter:")) query.set("filter", category.slice(7));
  return query.toString();
}

/** 서버 필터·커서로 읽고 이전 검색의 지연 응답과 취소된 페이지를 섞지 않는다. 정적 목록으로 실패를 숨기지 않는다. */
export function useGameCatalog(category: GameCategoryId, search: string) {
  const [attempt, setAttempt] = useState(0);
  const params = queryFor(category, search);
  const key = JSON.stringify([category, params, attempt]);
  const [page, setPage] = useState<Page>();
  const [moreState, setMoreState] = useState<{ key: string; pending: boolean }>();
  const more = useRef<AbortController | undefined>(undefined);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useCatalogResume(retry);
  useEffect(() => {
    const controller = new AbortController();
    // 실제 집계가 없는 인기 순위를 만들어 내지 않으며 기존 인기 필터의 빈 결과 동작을 유지한다.
    const timer = setTimeout(() => {
      if (category === "popular") { setPage({ key, items: [], nextCursor: null }); return; }
      void fetch(`/api/games?${params}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
        .then(requireSuccess).then(response => response.json()).then((value: unknown) => {
          if (!isCatalogPage(value)) throw new AuthRequestError("게임 목록 응답을 확인할 수 없습니다.", 502);
          if (!controller.signal.aborted) setPage({ key, ...value });
        }).catch(error => {
          if (!controller.signal.aborted) setPage({ key, items: [], nextCursor: null,
            error: error instanceof AuthRequestError ? error.message : "게임 목록에 연결하지 못했습니다. 다시 확인해 주세요." });
        });
    }, 200);
    return () => {
      clearTimeout(timer); controller.abort();
      // 취소된 이어 읽기가 늦게 끝나도 새 검색·복귀 조회의 버튼과 요청을 막지 않는다.
      const previous = more.current; more.current = undefined; previous?.abort();
    };
  }, [category, params, key]);
  async function loadMore() {
    if (more.current || page?.key !== key || !page.nextCursor) return;
    const controller = new AbortController(); more.current = controller; setMoreState({ key, pending: true });
    try {
      const query = new URLSearchParams(queryFor(category, search)); query.set("cursor", page.nextCursor);
      const response = await requireSuccess(await fetch(`/api/games?${query}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }));
      const value: unknown = await response.json();
      if (!isCatalogPage(value)) throw new AuthRequestError("게임 목록 응답을 확인할 수 없습니다.", 502);
      if (value.nextCursor === page.nextCursor) throw new AuthRequestError("게임 목록을 이어서 불러올 수 없습니다. 다시 확인해 주세요.", 502);
      if (!controller.signal.aborted) setPage(current => current?.key === key ? { key, items: [...new Map([...current.items, ...value.items].map(game => [game.code, game])).values()], nextCursor: value.nextCursor } : current);
    } catch (error) {
      if (!controller.signal.aborted) setPage(current => current?.key === key ? { ...current, error: error instanceof AuthRequestError ? error.message : "다음 게임을 불러오지 못했습니다." } : current);
    } finally { if (more.current === controller) { more.current = undefined; setMoreState({ key, pending: false }); } }
  }
  return { items: page?.key === key ? page.items : [], loading: page?.key !== key,
    error: page?.key === key ? page.error : undefined, hasMore: page?.key === key && !!page.nextCursor,
    morePending: moreState?.key === key && moreState.pending, loadMore, retry };
}

/** 사용 중인 필터는 커서를 자동으로 이어 읽어 홈 탐색에 전체 항목을 제공한다. */
export function useGameFilters() {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<{ attempt: number; items: readonly GameFilter[]; error?: string }>();
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useCatalogResume(retry);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const items = new Map<string, GameFilter>(), cursors = new Set<string>();
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ limit: "100" });
        if (cursor) params.set("cursor", cursor);
        const response = await requireSuccess(await fetch(`/api/game-filters?${params}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        }));
        const parsed = parseGameFilterPage(await response.json());
        for (const item of parsed.items) items.set(item.code, item);
        cursor = parsed.nextCursor;
        if (cursor && (cursors.has(cursor) || items.size >= 10000)) throw new AuthRequestError("필터 목록을 확인할 수 없습니다. 다시 확인해 주세요.", 502);
        if (cursor) cursors.add(cursor);
      } while (cursor);
      if (!controller.signal.aborted) setPage({ attempt, items: [...items.values()] });
    })().catch(error => { if (!controller.signal.aborted) setPage({ attempt, items: [], error: error instanceof AuthRequestError ? error.message : "필터를 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [attempt]);
  const current = page?.attempt === attempt ? page : undefined;
  return { items: current?.items ?? [], error: current?.error, pending: !current, retry };
}
