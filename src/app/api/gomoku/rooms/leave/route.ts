import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 방 나가기는 서명된 명시적 동작에서만 수행하고 새로고침을 퇴장으로 취급하지 않는다. 자동 종료는 lifecycle에서 구분한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "leave");
