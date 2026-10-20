/** 로그인 증명에는 비밀번호의 빠른 해시도 남기지 않는다. 자격 증명은 HTTPS/mTLS 안에서 직접 검증한다. */
export function proofBody(path: string, body: string): string {
  if (path !== "/api/auth/login") return body;
  const input: unknown = JSON.parse(body);
  if (typeof input !== "object" || input === null || !("username" in input) || typeof input.username !== "string"
    || !("keepLoggedIn" in input) || typeof input.keepLoggedIn !== "boolean") throw new TypeError("Invalid login binding");
  // 로그인 대상·유지 선택은 서명에 결합하고, 비밀번호는 증명·nonce·응답·로그에 포함하지 않는다.
  return JSON.stringify({ username: input.username, keepLoggedIn: input.keepLoggedIn });
}
