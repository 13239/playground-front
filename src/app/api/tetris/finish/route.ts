import { handleTetris } from "@/features/tetris/server/routes";
// 최종 점수 대신 제한된 tick별 입력만 서버에 전달한다.
export function POST(request: Request) {
  return handleTetris(request, "finish");
}
