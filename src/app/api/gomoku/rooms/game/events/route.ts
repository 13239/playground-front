import { handleGameRequest } from "@/features/gomoku/server/game-routes";

// 짧은 인증 스트림은 정상 종료 뒤 새 증명으로 다시 연결한다.
export const runtime = "nodejs";
export const POST = (request: Request) => handleGameRequest(request, true);
