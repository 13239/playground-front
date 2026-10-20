/** 세션 식별자의 형식만 검사한다. 인증과 세션 유효성 검사는 Spring이 수행한다. */
export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
