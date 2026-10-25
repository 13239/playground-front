"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGomokuCatalog } from "../client/use-gomoku-catalog";
import { gomokuPageTitle } from "../catalog-labels";

/** 관리자 탭에서 돌아와 표시 정보가 바뀌어도 판을 다시 만들지 않고 현재 문서 제목만 맞춘다. */
export function GomokuDocumentTitle() {
  const pathname = usePathname();
  const { game, error } = useGomokuCatalog();
  useEffect(() => {
    if (!game && !error) return;
    const screen = pathname === "/games/gomoku/ai" ? "ai" : pathname === "/games/gomoku/create" ? "create"
      : pathname.startsWith("/games/gomoku/rooms/") ? "room" : "list";
    document.title = `${gomokuPageTitle(game, screen)} | Playground`;
  }, [pathname, game, error]);
  return null;
}
