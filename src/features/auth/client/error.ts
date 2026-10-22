/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
export class AuthRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly code?: string;
  // 서버가 공개한 짧은 필드 메시지만 폼에 전달하며 입력 원문이나 내부 오류는 보관하지 않는다.
  readonly fieldErrors?: Readonly<Record<string, string>>;

  constructor(message: string, status: number, retryAfterSeconds?: number, code?: string, fieldErrors?: Readonly<Record<string, string>>) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** 프록시 HTML·예외 원문은 노출하지 않고 제한된 공개 오류만 읽는다. */
export async function requireSuccess(response: Response): Promise<Response> {
  if (response.ok) return response;
  // 본문을 제공하지 않는 프록시의 429도 표준 Retry-After(초 또는 HTTP 날짜)를 보존한다.
  const header = response.headers.get("Retry-After");
  const headerSeconds = header && /^\d{1,5}$/.test(header) ? Number(header)
    : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : undefined;
  let retryAfterSeconds = headerSeconds !== undefined && Number.isSafeInteger(headerSeconds) && headerSeconds > 0 && headerSeconds <= 86_400
    ? headerSeconds : undefined;
  let problem: unknown;
  try { problem = await response.json(); } catch { /* 프록시의 HTML 오류 응답은 화면에 노출하지 않는다. */ }
  if (typeof problem === "object" && problem !== null && "detail" in problem
    && typeof problem.detail === "string" && problem.detail.length <= 300) {
    const seconds = "retryAfterSeconds" in problem ? problem.retryAfterSeconds : undefined;
    if (typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400) {
      retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, seconds);
    }
    const code = "code" in problem && typeof problem.code === "string" && /^[A-Z_]{1,64}$/.test(problem.code) ? problem.code : undefined;
    const fieldErrors: Record<string, string> = {};
    if (code === "VALIDATION_FAILED" && "errors" in problem && typeof problem.errors === "object" && problem.errors !== null && !Array.isArray(problem.errors)) {
      for (const [field, message] of Object.entries(problem.errors).slice(0, 20)) {
        if (/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(field) && typeof message === "string" && message.length <= 300) fieldErrors[field] = message;
      }
    }
    throw new AuthRequestError(problem.detail, response.status,
      retryAfterSeconds, code,
      Object.keys(fieldErrors).length ? fieldErrors : undefined);
  }
  throw new AuthRequestError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", response.status, retryAfterSeconds);
}
