import "server-only";

// Spring 활동 로그의 user_agent 컬럼 길이와 맞춘다.
const MAX_LENGTH = 255;

/** 활동 로그에 남길 브라우저 User-Agent만 꺼낸다. 브라우저의 다른 헤더는 Spring에 전달하지 않는다. */
export function getClientUserAgent(request: Request): string | undefined {
  // 외부 입력이므로 출력 가능한 ASCII만 남겨 헤더 전달과 로그 저장에서 제어 문자를 차단한다.
  const value = request.headers.get("user-agent")?.replace(/[^\x20-\x7E]/g, "").trim();
  return value ? value.slice(0, MAX_LENGTH) : undefined;
}
