"use client";

import { useEffect, useRef, useState } from "react";
import { requireSuccess, AuthRequestError } from "@/features/auth/client/error";
import { isCatalogPage, isGenrePage, type CatalogGame, type CatalogGenre } from "../contracts";
import type { GameCategoryId } from "@/features/lobby/catalog";

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
  const key = `${category}|${queryFor(category, search)}`;
  const [page, setPage] = useState<Page>();
  const [attempt, setAttempt] = useState(0);
  const [morePending, setMorePending] = useState(false);
  const more = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    // 실제 집계가 없는 인기 순위를 만들어 내지 않으며 기존 인기 필터의 빈 결과 동작을 유지한다.
    const timer = setTimeout(() => {
      if (category === "popular") { setPage({ key, items: [], nextCursor: null }); return; }
      void fetch(`/api/games?${queryFor(category, search)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
        .then(requireSuccess).then(response => response.json()).then((value: unknown) => {
          if (!isCatalogPage(value)) throw new AuthRequestError("게임 목록 응답을 확인할 수 없습니다.", 502);
          if (!controller.signal.aborted) setPage({ key, ...value });
        }).catch(error => {
          if (!controller.signal.aborted) setPage({ key, items: [], nextCursor: null,
            error: error instanceof AuthRequestError ? error.message : "게임 목록에 연결하지 못했습니다. 다시 확인해 주세요." });
        });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); more.current?.abort(); };
  }, [category, search, key, attempt]);
  async function loadMore() {
    if (more.current || page?.key !== key || !page.nextCursor) return;
    const controller = new AbortController(); more.current = controller; setMorePending(true);
    try {
      const query = new URLSearchParams(queryFor(category, search)); query.set("cursor", page.nextCursor);
      const response = await requireSuccess(await fetch(`/api/games?${query}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }));
      const value: unknown = await response.json();
      if (!isCatalogPage(value)) throw new AuthRequestError("게임 목록 응답을 확인할 수 없습니다.", 502);
      if (!controller.signal.aborted) setPage(current => current?.key === key ? { key, items: [...new Map([...current.items, ...value.items].map(game => [game.code, game])).values()], nextCursor: value.nextCursor } : current);
    } catch (error) {
      if (!controller.signal.aborted) setPage(current => current?.key === key ? { ...current, error: error instanceof AuthRequestError ? error.message : "다음 게임을 불러오지 못했습니다." } : current);
    } finally { if (more.current === controller) { more.current = undefined; setMorePending(false); } }
  }
  return { items: page?.key === key ? page.items : [], loading: page?.key !== key,
    error: page?.key === key ? page.error : undefined, hasMore: page?.key === key && !!page.nextCursor,
    morePending, loadMore, retry: () => setAttempt(value => value + 1) };
}

/** 장르도 커서로 확장한다. 아직 읽지 않은 장르가 있으면 목록에서 이어서 요청한다. */
export function useGameGenres() {
  const [genres, setGenres] = useState<readonly CatalogGenre[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const running = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController(); running.current = controller;
    void fetch("/api/game-genres?limit=50", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(requireSuccess).then(response => response.json()).then((value: unknown) => {
        if (!isGenrePage(value)) throw new AuthRequestError("장르 응답을 확인할 수 없습니다.", 502);
        if (!controller.signal.aborted) { setGenres(value.items); setCursor(value.nextCursor); setError(undefined); }
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof AuthRequestError ? error.message : "장르를 불러오지 못했습니다."); })
      .finally(() => { if (running.current === controller) { running.current = undefined; setPending(false); } });
    return () => { controller.abort(); running.current?.abort(); running.current = undefined; };
  }, [attempt]);
  async function loadMore() {
    if (running.current || !cursor) return;
    const controller = new AbortController(); running.current = controller; setPending(true);
    try {
      const response = await requireSuccess(await fetch(`/api/game-genres?limit=50&cursor=${encodeURIComponent(cursor)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }));
      const value: unknown = await response.json();
      if (!isGenrePage(value)) throw new AuthRequestError("장르 응답을 확인할 수 없습니다.", 502);
      if (!controller.signal.aborted) { setGenres(current => [...new Map([...current, ...value.items].map(genre => [genre.code, genre])).values()]); setCursor(value.nextCursor); setError(undefined); }
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof AuthRequestError ? error.message : "장르를 불러오지 못했습니다."); }
    finally { if (running.current === controller) { running.current = undefined; setPending(false); } }
  }
  return { items: genres, error, hasMore: !!cursor, pending, loadMore, retry: () => setAttempt(value => value + 1) };
}
