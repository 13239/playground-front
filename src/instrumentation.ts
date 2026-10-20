/** 요청을 받기 전에 운영 IP 전달 설정을 검증해 모든 사용자가 BFF 주소 하나로 제한되는 배포를 막는다. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getTrustedClientIpHeaderName } = await import("./lib/server/env");
    getTrustedClientIpHeaderName();
  }
}
