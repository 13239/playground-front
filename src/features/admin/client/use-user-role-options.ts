"use client";

import { useEffect, useEffectEvent } from "react";
import { useAdminOptions } from "./use-admin-options";

/** 검색 없는 권한 필터·배정이 같은 커서 조회와 오류·재시도 정책을 공유한다. */
export function useUserRoleOptions(enabled = true) {
  const options = useAdminOptions<{ code: string; name: string }>("users/role-options", "권한", enabled, "", 0, 100);
  const loadNextPage = useEffectEvent(() => { void options.loadMore(); });
  useEffect(() => {
    // 일반 선택 목록에서 뒷페이지 권한이 빠지지 않도록 기존 커서 조회를 끝까지 이어서 읽는다.
    // 빠른 응답으로 로딩 상태가 한 번에 반영되어도 항목 변경을 기준으로 다음 페이지를 읽는다.
    if (enabled && options.hasMore && !options.moreBusy && !options.moreError) loadNextPage();
  }, [enabled, options.key, options.items, options.hasMore, options.moreBusy, options.moreError]);

  const error = options.error ?? options.moreError;
  return { items: options.items, error, loading: enabled && !error && (options.loading || options.hasMore), retry: options.retry };
}
