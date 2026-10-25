"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import type { CatalogArea } from "../catalog-grid-contracts";
import type { CatalogOrderItem, CatalogOrderPage, CatalogOrderResult } from "../catalog-order-contracts";
import { useAdminScope } from "../components/admin-ui";
import { adminRequest, errorMessage } from "./api";
import { invalidateAdminAccess } from "./use-admin-access";
import { currentPosition, movedPositions, orderChanged, orderMoves, originalPosition, type OrderOperation } from "./catalog-order-draft";

class OrderChangedError extends Error {}

/** 방문한 원본 페이지만 캐시하고 드래그 초안은 위치 변환으로 유지한다. 저장 전에는 서버를 변경하지 않는다. */
export function useCatalogOrder(area: CatalogArea, size: number, saved: () => void) {
  const { sessionId, notifySaved, can } = useAdminScope();
  const writable = can("GAME_WRITE");
  const [page, setPage] = useState(1);
  const [operations, setOperations] = useState<readonly OrderOperation[]>([]);
  const [metadata, setMetadata] = useState<{ version: number; count: number }>();
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<{ key: string; items?: readonly CatalogOrderItem[]; error?: string }>({ key: "" });
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const cache = useRef(new Map<number, CatalogOrderItem>());
  const pages = useRef(new Set<number>());
  const snapshot = useRef<{ version: number; count: number } | undefined>(undefined);
  const saving = useRef<AbortController | undefined>(undefined);
  const key = `${page}:${operations.length}:${revision}`;
  const dirty = orderChanged(operations);

  const fetchPage = useCallback(async (number: number, signal: AbortSignal) => {
    if (pages.current.has(number)) return;
    const result = await adminRequest<CatalogOrderPage>(sessionId, `${area}/order?page=${number}&size=${size}`, "GET", undefined, signal);
    signal.throwIfAborted();
    const current = snapshot.current;
    if (current && (result.version !== current.version || result.totalElements !== current.count)) {
      throw new OrderChangedError("다른 관리자가 순서를 변경했어요. 취소한 뒤 순서 변경을 다시 시작해 주세요.");
    }
    if (!current) {
      snapshot.current = { version: result.version, count: result.totalElements };
      setMetadata(snapshot.current);
    }
    for (const item of result.items) cache.current.set(item.sortOrder, item);
    pages.current.add(result.page);
  }, [area, sessionId, size]);

  const ensurePositions = useCallback(async (positions: readonly number[], signal: AbortSignal) => {
    const missing = [...new Set(positions.filter(position => !cache.current.has(position)).map(position => Math.floor(position / size) + 1))];
    await Promise.all(missing.map(number => fetchPage(number, signal)));
  }, [fetchPage, size]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await fetchPage(1, controller.signal);
      const count = snapshot.current!.count;
      const start = (page - 1) * size;
      const positions = Array.from({ length: Math.max(0, Math.min(size, count - start)) }, (_, index) => originalPosition(start + index, operations));
      await ensurePositions(positions, controller.signal);
      controller.signal.throwIfAborted();
      setView({ key, items: positions.map((original, index) => ({ ...cache.current.get(original)!, sortOrder: start + index })) });
    })().catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof OrderChangedError) setConflict(true);
      setView({ key, error: failure instanceof OrderChangedError ? failure.message : errorMessage(failure) });
    });
    return () => controller.abort();
  }, [page, size, operations, revision, key, fetchPage, ensurePositions]);

  useEffect(() => () => saving.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function move(from: number, to: number) {
    if (!writable || busy || conflict || !metadata || view.key !== key || !view.items || from === to || to < 0 || to >= metadata.count) return false;
    const original = originalPosition(from, operations);
    const moved = movedPositions(operations);
    if (moved.length >= 100 && !moved.includes(original)) {
      setError("한 번에 100개 항목까지 순서를 바꿀 수 있어요. 먼저 저장한 뒤 이어서 변경해 주세요."); return false;
    }
    setError(undefined);
    setOperations(current => [...current, { from, to, original }]);
    setPage(Math.floor(to / size) + 1);
    return true;
  }

  async function save() {
    if (!writable || saving.current || !dirty || conflict || !metadata || view.key !== key || !view.items) return;
    const controller = new AbortController(); saving.current = controller; setBusy(true); setError(undefined);
    try {
      // 최종 위치의 다음 행만 추가 조회하면 반복 드래그도 중복 코드 없는 요청으로 정리할 수 있다.
      const originals = movedPositions(operations);
      const anchors = originals.map(original => currentPosition(original, operations) + 1)
        .filter(position => position < metadata.count).map(position => originalPosition(position, operations));
      await ensurePositions([...originals, ...anchors], controller.signal);
      const moves = orderMoves(metadata.count, operations, original => cache.current.get(original)!.code);
      await adminRequest<CatalogOrderResult>(sessionId, `${area}/order`, "PUT", { expectedVersion: metadata.version, moves }, controller.signal);
      controller.signal.throwIfAborted();
      notifySaved(); saved();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof OrderChangedError || failure instanceof AuthRequestError && failure.status === 409) setConflict(true);
      if (failure instanceof AuthRequestError && failure.status === 403) invalidateAdminAccess();
      setError(failure instanceof OrderChangedError ? failure.message : errorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      saving.current = undefined;
    }
  }
  return { page, setPage, items: view.key === key ? view.items : undefined,
    loadError: view.key === key ? view.error : undefined, error, conflict, busy, dirty, writable,
    loading: view.key !== key || !view.items, count: metadata?.count ?? 0,
    totalPages: Math.max(1, Math.ceil((metadata?.count ?? 0) / size)), move, save,
    retry: () => setRevision(value => value + 1) };
}
