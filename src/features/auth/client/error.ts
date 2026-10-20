/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
export class AuthRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly code?: string;

  constructor(message: string, status: number, retryAfterSeconds?: number, code?: string) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
  }
}

/** 프록시 HTML·예외 원문은 노출하지 않고 제한된 공개 오류만 읽는다. */
export async function requireSuccess(response: Response): Promise<Response> {
  if (response.ok) return response;
  let problem: unknown;
  try { problem = await response.json(); } catch { /* 프록시의 HTML 오류 응답은 화면에 노출하지 않는다. */ }
  if (typeof problem === "object" && problem !== null && "detail" in problem
    && typeof problem.detail === "string" && problem.detail.length <= 300) {
    const seconds = "retryAfterSeconds" in problem ? problem.retryAfterSeconds : undefined;
    const code = "code" in problem && typeof problem.code === "string" && /^[A-Z_]{1,64}$/.test(problem.code) ? problem.code : undefined;
    throw new AuthRequestError(problem.detail, response.status,
      typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined, code);
  }
  throw new AuthRequestError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", response.status);
}
