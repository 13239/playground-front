"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest, errorMessage } from "./api";

/** 경로·세션이 달라지면 이전 데이터는 표시하지 않고, 취소된 검색 응답은 현재 선택을 덮어쓰지 않는다. */
export function useAdminResource<T>(sessionId: string, path: string) {
  const key = `${sessionId}:${path}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; revision: number; data?: T; error?: string }>({ key: "", revision: -1 });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void adminRequest<T>(sessionId, path, "GET", undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, revision, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, revision, error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [sessionId, path, key, revision]);
  const reload = useCallback(() => setRevision(v => v + 1), []);
  // 새로고침 중에도 현재 데이터를 유지하되 버튼은 중복 조회를 보내지 않게 비활성화한다.
  const loading = Boolean(path) && (state.key !== key || state.revision !== revision);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, reload, revision, loading };
}
