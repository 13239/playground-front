import { Suspense, type ReactNode } from "react";
import { SessionContent } from "@/app/_components/session-content";
import { GameCatalogProvider } from "@/features/games/components/game-catalog-provider";
import { ShootingShell } from "@/features/shooting/components/shooting-shell";

/** 인증·카탈로그는 다른 미니게임과 같은 경계를 사용한다. */
export default function ShootingLayout({ children }: { children: ReactNode }) {
  return (
    <ShootingShell
      account={
        <Suspense fallback={<p role="status">로그인 확인 중…</p>}>
          <SessionContent />
        </Suspense>
      }
    >
      <GameCatalogProvider code="SHOOTING">{children}</GameCatalogProvider>
    </ShootingShell>
  );
}
