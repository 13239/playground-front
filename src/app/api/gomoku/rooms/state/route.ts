import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 본인의 대기실만 조회하며 응답은 공유 캐시에 저장하지 않는다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "state");
