/** 로그인·방 비밀번호의 빠른 해시를 증명에 남기지 않는다. 자격 증명은 HTTPS/mTLS 안에서 직접 검증한다. */
export function proofBody(path: string, body: string): string {
  // 카드 게임의 짧은 방 비밀번호도 오프라인 대입 가능한 빠른 서명 해시에서 제외한다.
  if (path === "/api/memory/create" || path === "/api/memory/join") {
    const input: unknown = JSON.parse(body);
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError("Invalid memory room binding");
    return JSON.stringify(Object.fromEntries(Object.entries(input).filter(([key]) => key !== "password")));
  }
  // 비밀번호 변경·회원탈퇴도 빠른 해시에서 비밀번호를 제외하고 변경 대상인 현재 세션만 서명에 결합한다.
  if (path === "/api/auth/password" || path === "/api/auth/withdrawal") {
    const input: unknown = JSON.parse(body);
    if (typeof input !== "object" || input === null || !("sessionId" in input) || typeof input.sessionId !== "string") {
      throw new TypeError("Invalid password change binding");
    }
    return JSON.stringify({ sessionId: input.sessionId });
  }
  if (path !== "/api/auth/login" && path !== "/api/gomoku/rooms" && path !== "/api/gomoku/rooms/join" && path !== "/api/gomoku/rooms/settings") return body;
  const input: unknown = JSON.parse(body);
  // 짧은 방 비밀번호도 오프라인 대입의 대상이 되지 않게 제외하고 나머지 설정·세션·요청 ID는 묶는다.
  // 비공개 방 입장의 비밀번호도 생성과 같은 정책으로 빠른 해시에서 제외한다.
  // 방 설정의 새 비밀번호도 제외하되 방·페이지·편집 순서와 나머지 설정은 서명에 결합한다.
  if (path === "/api/gomoku/rooms" || path === "/api/gomoku/rooms/join" || path === "/api/gomoku/rooms/settings") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError("Invalid room binding");
    return JSON.stringify(Object.fromEntries(Object.entries(input).filter(([key]) => key !== "password")));
  }
  if (typeof input !== "object" || input === null || !("username" in input) || typeof input.username !== "string"
    || !("keepLoggedIn" in input) || typeof input.keepLoggedIn !== "boolean"
    || "replaceExistingSession" in input && typeof input.replaceExistingSession !== "boolean") throw new TypeError("Invalid login binding");
  // 로그인 대상·유지 선택·교체 동의는 서명에 결합하고, 비밀번호는 증명·nonce·응답·로그에 포함하지 않는다.
  // 동의 필드가 없는 기존 클라이언트의 서명은 그대로 검증하되 서버에서는 교체 동의 없음으로 처리한다.
  return JSON.stringify({
    username: input.username,
    keepLoggedIn: input.keepLoggedIn,
    ...("replaceExistingSession" in input && { replaceExistingSession: input.replaceExistingSession }),
  });
}
