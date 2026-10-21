import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 기존 BFF 인증 경계에서 공개·비공개·초대 코드 입장을 처리한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "join");
