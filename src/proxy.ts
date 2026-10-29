import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin, getChatWebSocketOrigin } from "@/lib/server/env";
import { getShootingSocketOrigin } from "@/features/shooting/server/config";

/** HTML마다 새로운 nonce를 생성한다. 외부 x-nonce/CSP 헤더는 덮어쓰며 인증 판별은 API에서 수행한다. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64");
  const development = process.env.NODE_ENV === "development";
  // dev도 최적화 빌드의 엄격한 CSP를 쓴다. HTTPS 강제 헤더만 공개 Origin의 실제 프로토콜에 맞춘다.
  const https = getAppOrigin().startsWith("https://");
  // HMR·같은 호스트의 운영 WSS·로컬 chat 포트만 허용하고 임의의 ws:/wss: 서버 전체는 열지 않는다.
  // 슈팅도 설정에서 검증한 정확한 WebSocket Origin 한 곳만 추가한다.
  // 로컬 Colyseus 참가 예약은 같은 게임 서버의 HTTP로 보내며 그 정확한 Origin도 함께 허용한다.
  const socketSources = [...new Set([getAppOrigin().replace(/^http/, "ws"), getChatWebSocketOrigin(), getShootingSocketOrigin(), getShootingSocketOrigin().replace(/^ws/, "http")])].join(" ");
  const csp = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'", development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // next/image의 위치·크기 스타일 속성만 허용한다. 스크립트의 inline 실행은 별도로 금지한다.
    "style-src-attr 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'",
    "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    // AI 탐색 워커는 번들된 같은 출처 파일만 실행하며 blob·외부 워커는 허용하지 않는다.
    "worker-src 'self'",
    `connect-src 'self' ${socketSources}`,
    ...(https && !development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  // HTML/RSC에는 요청별 nonce와 사용자 경계가 있으므로 공유 캐시를 허용하지 않는다.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  if (https && !development) response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}

// API 인증을 프리패치/Proxy 검사로 대체하지 않는다. nonce는 HTML과 RSC 요청 모두에 필요하다.
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|fonts).*)"] };
