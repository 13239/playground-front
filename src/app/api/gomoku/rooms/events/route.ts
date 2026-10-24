import { handleLobbyEvents } from "@/features/gomoku/server/lobby-events-route";

/** 오목 로비 전용 SSE는 Node 런타임에서 기존 쿠키/요청 증명 경계로 중계한다. */
export const runtime = "nodejs";
export const POST = (request: Request) => handleLobbyEvents(request);
