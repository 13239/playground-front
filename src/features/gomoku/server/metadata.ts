import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { readPublicGame } from "@/features/games/server/catalog";
import { gomokuPageTitle, type GomokuScreen } from "../catalog-labels";

/** 요청 안에서만 공유한다. 숨김·장애 시 이전 게임명이나 보호된 방 정보를 메타데이터에 남기지 않는다. */
const currentGame = cache(async () => {
  await connection();
  try { return await readPublicGame("GOMOKU"); } catch { return undefined; }
});

export async function gomokuMetadata(screen: GomokuScreen): Promise<Metadata> {
  const game = await currentGame();
  return { title: gomokuPageTitle(game, screen), description: game?.summary ?? "게임 이용 정보를 확인해 주세요." };
}
