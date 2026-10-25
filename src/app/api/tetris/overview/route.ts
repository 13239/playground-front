import { handleTetris } from "@/features/tetris/server/routes";
// 개인 전적과 번호 페이지 조회도 공통 인증 요청 경계를 사용한다.
export function POST(request: Request) {
  return handleTetris(request, "overview");
}
