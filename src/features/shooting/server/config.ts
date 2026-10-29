import "server-only";
import { getAppEnvironment, getAppOrigin } from "@/lib/server/env";

/** CSP와 참가권 응답 검증이 같은 고정된 게임 서버 주소를 사용한다. */
export function getShootingEndpoint(): string {
  const app = new URL(getAppOrigin());
  // 로컬은 Node 게임 서버(8082)에 직접 연결하고 dev/prod는 기존 동일 Origin 프록시를 사용한다.
  const local = getAppEnvironment() === "local";
  const fallback = local
    ? `${app.protocol === "https:" ? "wss" : "ws"}://${app.hostname}:8082`
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
