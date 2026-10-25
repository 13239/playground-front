"use client";

import { useGameDetails } from "@/features/games/components/game-catalog-provider";
import { catalogModeEntry } from "@/features/games/catalog-policy";

/** 실행 코드는 고정하고 관리자가 수정한 표시 이름·소개와 각 모드의 현재 상태를 사용한다. */
export function useGomokuCatalog() {
  const details = useGameDetails();
  return { ...details, name: details.game?.name ?? "게임", ai: catalogModeEntry(details.game, "AI", details.error),
    online: catalogModeEntry(details.game, "ONLINE", details.error) };
}
