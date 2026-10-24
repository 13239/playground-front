import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 방장만 상대 좌석을 강퇴하도록 서버가 점유권과 변경 순서를 검사한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "kick");
