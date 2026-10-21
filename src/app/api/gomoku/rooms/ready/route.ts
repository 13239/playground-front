import { handleRoomRequest } from "@/features/gomoku/server/room-routes";

/** 준비와 준비 취소는 같은 요청 계약으로 명시적인 값을 전달한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleRoomRequest(request, "ready");
