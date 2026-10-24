import { Suspense } from "react";
import { SessionContent } from "./_components/session-content";
import { LobbyShell } from "./_components/lobby/lobby-shell";

export default function Home() {
  // 서버 화면 틀에는 인증 정보를 넣지 않는다. 경계 안의 브라우저가 키를 증명한 뒤 사용자 정보를 읽는다.
  return (
    // 게임 목록·배너는 공개 표시용 데이터이며 실제 계정은 기존 브라우저 세션 검증을 그대로 사용한다.
    // 홈 PC/모바일 채팅은 공통 루트의 전역 로그인 세션 단일 WebSocket을 공유한다.
    <LobbyShell
      account={
        <Suspense fallback={<p role="status">로그인 확인 중…</p>}>
          <SessionContent />
        </Suspense>
      }
    />
  );
}
