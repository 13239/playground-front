import { Suspense, type ReactNode } from "react";
import { SessionContent } from "@/app/_components/session-content";
import { GomokuShell } from "@/features/gomoku/components/gomoku-shell";
import { GameCatalogProvider } from "@/features/games/components/game-catalog-provider";
import { GomokuDocumentTitle } from "@/features/gomoku/components/gomoku-document-title";

/** HTML에는 공개 틀만 렌더링하고 기존 세션 경계가 브라우저 키를 검증한 뒤 계정을 표시한다. */
export default function GomokuLayout({ children }: { children: ReactNode }) {
  return (
    <GomokuShell
      account={
        <Suspense fallback={<p role="status">로그인 확인 중…</p>}>
          <SessionContent />
        </Suspense>
      }
    >
      {/* 공개 표시 정보만 공유하며 세션·진행 중인 판의 수명은 기존 화면이 관리한다. */}
      <GameCatalogProvider code="GOMOKU"><GomokuDocumentTitle />{children}</GameCatalogProvider>
    </GomokuShell>
  );
}
