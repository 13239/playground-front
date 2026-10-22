/**
 * 브라우저의 UUID v4를 생성한다.
 * HTTPS/localhost처럼 randomUUID()를 지원하는 환경에서는 네이티브 API를 우선 사용한다.
 * 일반 HTTP 개발 서버에서는 getRandomValues()로 동일한 RFC 4122 UUID v4를 생성한다.
 * 안전한 난수 생성 API가 모두 없다면 Math.random()으로 대체하지 않고 실패시킨다.
 */
export function createUuidV4(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    try {
      return webCrypto.randomUUID();
    } catch {
      // 일부 환경에서는 API가 존재해도 비보안 컨텍스트에서 호출이 거부된다.
    }
  }

  if (typeof webCrypto?.getRandomValues !== "function") {
    throw new Error("안전한 UUID 난수 생성 기능을 사용할 수 없습니다.");
  }

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
