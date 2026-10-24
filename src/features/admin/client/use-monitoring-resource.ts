"use client";

import { useEffect } from "react";
import { useAdminResource } from "./use-admin-resource";

/** 보이는 관리자 화면만 30초마다 갱신하며 진행 중인 요청·숨겨진 문서의 폴링은 만들지 않는다. */
export function useMonitoringResource<T>(sessionId: string, path: string) {
  const resource = useAdminResource<T>(sessionId, path);
  const { reload, loading } = resource;
  useEffect(() => {
    const timer = window.setInterval(() => { if (!loading && document.visibilityState === "visible") reload(); }, 30000);
    return () => window.clearInterval(timer);
  }, [reload, loading]);
  return resource;
}
