import { handleTetris } from "@/features/tetris/server/routes";
// 서버가 발급한 시드와 플레이 식별자로 한 판을 시작한다.
export function POST(request: Request) {
  return handleTetris(request, "start");
}
