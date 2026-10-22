import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 종료 keepalive 요청도 일반 방 API와 같은 Origin·로그인·브라우저 서명을 검증한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "lifecycle");
