import type { Metadata } from "next";
import { TetrisScreen } from "@/features/tetris/components/tetris-screen";

export const metadata: Metadata = {
  title: "테트리스",
  description: "블록을 쌓고, 나만의 최고 기록에 도전하는 1인 테트리스.",
};
// 렌더러는 인증·게임 이용 확인 뒤 브라우저에서만 지연 로딩한다.
export default function TetrisPage() {
  return <TetrisScreen />;
}
