"use client";

import { useEffect, useState } from "react";
import type { GameFilter, GameFilterPage } from "@/features/games/filter-contracts";
import { adminRequest, errorMessage } from "./api";

/** 선택기·홈 미리보기는 커서를 이어 읽고 오래된 계정·갱신 응답은 적용하지 않는다. */
export function useFilterOptions(sessionId: string, revision = 0) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; items: readonly GameFilter[]; error?: string }>();
  const key = `${sessionId}:${revision}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const items: GameFilter[] = [], cursors = new Set<string>();
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ limit: "100" });
        if (cursor) params.set("cursor", cursor);
        const page: GameFilterPage = await adminRequest(sessionId, `game-filters/options?${params}`, "GET", undefined, controller.signal);
        items.push(...page.items); cursor = page.nextCursor;
        if (cursor && (cursors.has(cursor) || items.length >= 10000)) throw new Error("필터 목록을 확인하지 못했습니다.");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      if (!controller.signal.aborted) setState({ key, items });
    })().catch(error => { if (!controller.signal.aborted) setState({ key, items: [], error: errorMessage(error) }); });
    return () => controller.abort();
  }, [sessionId, key]);
  return { retry: () => setAttempt(value => value + 1), items: state?.key === key ? state.items : [], loading: state?.key !== key, error: state?.key === key ? state.error : undefined };
}
