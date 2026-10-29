import "server-only";
import { getAppOrigin } from "@/lib/server/env";

/** CSP와 참가권 응답 검증이 같은 고정된 게임 서버 주소를 사용한다. */
export function getShootingEndpoint(): string {
  const app = new URL(getAppOrigin());
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) &&
    app.port === "3000";
  const fallback = local
    ? `${app.protocol === "https:" ? "wss" : "ws"}://${app.hostname}:9083`
    : `${app.origin.replace(/^http/, "ws")}/game-realtime`;
  const endpoint = new URL(process.env.GAME_PUBLIC_URL || fallback);
  if (
    !["ws:", "wss:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (app.protocol === "https:" && endpoint.protocol !== "wss:")
  )
    throw new Error("게임 서버 주소 설정이 올바르지 않습니다.");
  return endpoint.href.replace(/\/$/, "");
}
export const getShootingSocketOrigin = (): string =>
  new URL(getShootingEndpoint()).origin;
