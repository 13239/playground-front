import { handleGameRequest } from "@/features/gomoku/server/game-routes";

// 기존 BFF 경계에서 검증한 대국 명령만 MVC 서버로 전달한다.
export const POST = (request: Request) => handleGameRequest(request);
