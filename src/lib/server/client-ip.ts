import "server-only";

import { isIP } from "node:net";
import { ApiError } from "./api-error";
import { getTrustedClientIpHeaderName } from "./env";

/** 신뢰 프록시가 덮어쓰도록 배포에서 지정한 단일 IP 헤더만 허용한다. */
export function getTrustedClientIp(request: Request): string | undefined {
  const name = getTrustedClientIpHeaderName();
  // 직접 접속하는 개발 환경에서는 전달 헤더를 신뢰하지 않고 Spring의 연결 IP를 사용한다.
  if (!name) return undefined;
  // 운영은 시작 시에도 설정을 확인하며, 신뢰 프록시가 외부의 같은 이름 헤더를 반드시 덮어써야 한다.

  const ip = request.headers.get(name)?.trim();
  // 쉼표 목록·포트·IPv6 zone ID는 허용하지 않으며 잘못된 값으로 제한 키를 만들지 않는다.
  if (!ip || ip.length > 45 || ip.includes("%") || !isIP(ip)) throw new ApiError("INVALID_REQUEST_BODY");
  return ip;
}
