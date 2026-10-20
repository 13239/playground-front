import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 방 생성은 기존 로그인·서명 경계를 공유하며 외부 백엔드 주소를 받지 않는다. */
export const POST = (request: Request) => handleRoomRequest(request, "create");
