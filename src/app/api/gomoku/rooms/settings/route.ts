import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 방장 설정 변경도 동일 Origin·로그인 세션·브라우저 증명으로 보호한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "settings");
