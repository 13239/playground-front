import "server-only";

import { ApiError } from "./api-error";
import { getAppOrigin } from "./env";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/** 쿠키로 인증하는 변경 요청은 배포 설정의 공개 Origin과 일치해야 한다. */
export function assertSameOrigin(request: Request): void {
  if (safeMethods.has(request.method)) return;

  // Host·X-Forwarded-Host 등 클라이언트가 위조할 수 있는 헤더로 허용 Origin을 만들지 않는다.
  if (
    request.headers.get("origin") !== getAppOrigin()
    || request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new ApiError("INVALID_ORIGIN");
  }
}
