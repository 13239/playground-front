import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 검색어·필터·페이지를 서명한 JSON 본문으로 수신한다. */
export const POST = (request: Request) => handleRoomRequest(request, "search");
