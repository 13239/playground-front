import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 소유자가 만든 빈 대기방만 닫는다. 최종 소유권 검사는 Spring이 수행한다. */
export const POST = (request: Request) => handleRoomRequest(request, "close");
