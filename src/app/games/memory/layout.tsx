import { Suspense,type ReactNode } from "react";
import { SessionContent } from "@/app/_components/session-content";
import { GameCatalogProvider } from "@/features/games/components/game-catalog-provider";
import { MemoryShell } from "@/features/memory/components/memory-shell";

/** 보호된 게임 데이터는 클라이언트 인증 뒤에 읽으며 HTML에는 공통 공개 틀만 포함한다. */
export default function MemoryLayout({children}:{children:ReactNode}){
  return <MemoryShell account={<Suspense fallback={<p role="status">로그인 확인 중…</p>}><SessionContent/></Suspense>}>
    <GameCatalogProvider code="MEMORY">{children}</GameCatalogProvider>
  </MemoryShell>;
}
