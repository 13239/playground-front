import { Suspense, type ReactNode } from "react";
import { SessionContent } from "@/app/_components/session-content";
import { GameCatalogProvider } from "@/features/games/components/game-catalog-provider";
import { TetrisShell } from "@/features/tetris/components/tetris-shell";

/** 공개 페이지 틀과 브라우저 인증 경계를 분리하며 공통 게임 이용 정책을 공유한다. */
export default function TetrisLayout({ children }: { children: ReactNode }) {
  return (
    <TetrisShell
      account={
        <Suspense fallback={<p role="status">로그인 확인 중…</p>}>
          <SessionContent />
        </Suspense>
      }
    >
      <GameCatalogProvider code="TETRIS">{children}</GameCatalogProvider>
    </TetrisShell>
  );
}
