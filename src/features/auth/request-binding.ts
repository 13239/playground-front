/** 로그인·방 비밀번호의 빠른 해시를 증명에 남기지 않는다. 자격 증명은 HTTPS/mTLS 안에서 직접 검증한다. */
export function proofBody(path: string, body: string): string {
  if (path !== "/api/auth/login" && path !== "/api/gomoku/rooms") return body;
  const input: unknown = JSON.parse(body);
  // 짧은 방 비밀번호도 오프라인 대입의 대상이 되지 않게 제외하고 나머지 설정·세션·요청 ID는 묶는다.
  if (path === "/api/gomoku/rooms") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError("Invalid room binding");
    return JSON.stringify(Object.fromEntries(Object.entries(input).filter(([key]) => key !== "password")));
  }
  if (typeof input !== "object" || input === null || !("username" in input) || typeof input.username !== "string"
    || !("keepLoggedIn" in input) || typeof input.keepLoggedIn !== "boolean") throw new TypeError("Invalid login binding");
  // 로그인 대상·유지 선택은 서명에 결합하고, 비밀번호는 증명·nonce·응답·로그에 포함하지 않는다.
  return JSON.stringify({ username: input.username, keepLoggedIn: input.keepLoggedIn });
}
