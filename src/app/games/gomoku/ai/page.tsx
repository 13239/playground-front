import { gomokuMetadata } from "@/features/gomoku/server/metadata";
import { notFound } from "next/navigation";
import { isAiDifficulty, isAiRule } from "@/features/gomoku/ai/contracts";
import { AiGameScreen } from "@/features/gomoku/components/ai-game";

// 모드 코드는 유지하고 관리자에 등록된 AI 모드 이름을 제목에 반영한다.
export function generateMetadata() { return gomokuMetadata("ai"); }

/** URL에는 검증한 난이도·규칙만 사용한다. 혼자 하는 대국의 방·기보·계정 데이터는 서버에 생성하지 않는다. */
export default async function AiGamePage({ searchParams }: { searchParams: Promise<{ difficulty?: string | string[]; rule?: string | string[] }> }) {
  const params = await searchParams;
  // 기존 난이도 전용 링크는 자유 룰로 열어 호환성을 유지한다.
  const difficulty = params.difficulty ?? "normal", rule = params.rule ?? "freestyle";
  if (!isAiDifficulty(difficulty) || !isAiRule(rule)) notFound();
  return <AiGameScreen key={`${difficulty}:${rule}`} difficulty={difficulty} rule={rule} />;
}
