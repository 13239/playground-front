"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requireSuccess, AuthRequestError } from "@/features/auth/client/error";
import { isCatalogPage, isGenrePage, type CatalogGame, type CatalogGenre } from "../contracts";
import type { GameCategoryId } from "@/features/lobby/catalog";
import { useCatalogResume } from "./use-catalog-resume";

type Page = Readonly<{ key: string; items: readonly CatalogGame[]; nextCursor: string | null; error?: string }>;
function queryFor(category: GameCategoryId, search: string): string {
  const query = new URLSearchParams({ limit: "40" });
  if (search.trim()) query.set("query", search.trim());
  if (category === "2d" || category === "3d") query.set("graphics", category === "2d" ? "TWO_D" : "THREE_D");
  if (category === "singleplayer" || category === "multiplayer") query.set("players", category === "singleplayer" ? "SINGLE" : "MULTIPLAYER");
  if (category === "twoplayer" || category === "group") query.set("players", category === "twoplayer" ? "TWO" : "GROUP");
  if (category === "new") query.set("newOnly", "true");
  if (category.startsWith("genre:")) query.set("genre", category.slice(6));
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

/** 장르도 커서로 확장한다. 아직 읽지 않은 장르가 있으면 목록에서 이어서 요청한다. */
export function useGameGenres() {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<{ attempt: number; items: readonly CatalogGenre[]; nextCursor: string | null; error?: string }>();
  const [moreState, setMoreState] = useState<{ attempt: number; pending: boolean }>();
  const running = useRef<AbortController | undefined>(undefined);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useCatalogResume(retry);
  useEffect(() => {
    const controller = new AbortController(); running.current = controller;
    void fetch("/api/game-genres?limit=50", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(requireSuccess).then(response => response.json()).then((value: unknown) => {
        if (!isGenrePage(value)) throw new AuthRequestError("장르 응답을 확인할 수 없습니다.", 502);
        if (!controller.signal.aborted) setPage({ attempt, ...value });
      }).catch(error => { if (!controller.signal.aborted) setPage({ attempt, items: [], nextCursor: null, error: error instanceof AuthRequestError ? error.message : "장르를 불러오지 못했습니다." }); })
      .finally(() => { if (running.current === controller) running.current = undefined; });
    return () => { controller.abort(); running.current?.abort(); running.current = undefined; };
  }, [attempt]);
  async function loadMore() {
    if (running.current || page?.attempt !== attempt || !page.nextCursor) return;
    const controller = new AbortController(); running.current = controller; setMoreState({ attempt, pending: true });
    try {
      const response = await requireSuccess(await fetch(`/api/game-genres?limit=50&cursor=${encodeURIComponent(page.nextCursor)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }));
      const value: unknown = await response.json();
      if (!isGenrePage(value)) throw new AuthRequestError("장르 응답을 확인할 수 없습니다.", 502);
      if (value.nextCursor === page.nextCursor) throw new AuthRequestError("장르 목록을 이어서 불러올 수 없습니다. 다시 확인해 주세요.", 502);
      if (!controller.signal.aborted) setPage(current => current?.attempt === attempt ? { attempt,
        items: [...new Map([...current.items, ...value.items].map(genre => [genre.code, genre])).values()], nextCursor: value.nextCursor } : current);
    } catch (error) { if (!controller.signal.aborted) setPage(current => current?.attempt === attempt ? { ...current, error: error instanceof AuthRequestError ? error.message : "장르를 불러오지 못했습니다." } : current); }
    finally { if (running.current === controller) { running.current = undefined; setMoreState({ attempt, pending: false }); } }
  }
  const current = page?.attempt === attempt ? page : undefined;
  return { items: current?.items ?? [], error: current?.error, hasMore: !!current?.nextCursor,
    pending: !current || moreState?.attempt === attempt && moreState.pending, loadMore, retry };
}
