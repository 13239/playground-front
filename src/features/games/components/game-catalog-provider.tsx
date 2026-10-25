"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthRequestError, requireSuccess } from "@/features/auth/client/error";
import { gameCodePattern, isCatalogGame, type CatalogGame } from "../contracts";
import { useCatalogResume } from "../client/use-catalog-resume";

type Details = Readonly<{ game?: CatalogGame; error?: string }>;
const GameDetails = createContext<(Details & { refresh: () => void }) | undefined>(undefined);

/** 같은 게임의 표시 정보를 공유한다. 정책 재조회가 진행 중인 판·워커·방 연결을 재생성하지 않는다. */
export function GameCatalogProvider({ code, children }: { code: string; children: ReactNode }) {
  const pathname = usePathname();
  const [details, setDetails] = useState<Details & { code?: string }>({});
  const running = useRef<AbortController | undefined>(undefined);
  const refresh = useCallback(() => {
    if (!gameCodePattern.test(code)) return;
    // 복귀 전에 시작한 느린 응답을 재사용하지 않고 현재 정책을 새로 읽는다.
    running.current?.abort();
    const controller = new AbortController(); running.current = controller;
    void fetch(`/api/games/${code}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(requireSuccess).then(response => response.json()).then((value: unknown) => {
        if (!isCatalogGame(value) || value.code !== code || !value.published) throw new AuthRequestError("게임 정보를 확인할 수 없습니다.", 502);
        if (!controller.signal.aborted) setDetails({ code, game: value });
      }).catch(failure => {
        if (!controller.signal.aborted) setDetails(current => ({ code, game: current.code === code ? current.game : undefined,
          error: failure instanceof AuthRequestError ? failure.message : "게임 정보를 불러오지 못했어요. 다시 확인해 주세요." }));
      }).finally(() => { if (running.current === controller) running.current = undefined; });
  }, [code]);
  useEffect(() => {
    refresh();
    // 관리 화면 복귀는 공통 구독이 맡으며 경로 변경 때 진행 중인 이전 조회만 취소한다.
    return () => {
      const previous = running.current; running.current = undefined; previous?.abort(); };
  }, [pathname, refresh]);
  useCatalogResume(refresh);
  const current = details.code === code ? details : {};
  return <GameDetails value={{ ...current, refresh }}>{children}</GameDetails>;
}

export function useGameDetails() {
  const details = use(GameDetails);
  if (!details) throw new Error("게임 정보 공급자가 필요합니다.");
  return details;
}
