import type { LoginInput } from "../types";

/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
export class AuthRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function authMutation(path: "/api/auth/login" | "/api/auth/logout", input?: LoginInput): Promise<void> {
  let response: Response;
  try {
    // 동일 Origin의 BFF만 호출하며 인증 토큰을 읽거나 브라우저 저장소에 보관하지 않는다.
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
    });
  } catch {
    throw new AuthRequestError("서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
  }
  if (response.status === 204) return;

  let problem: unknown;
  try { problem = await response.json(); } catch { /* 프록시의 HTML 오류 응답은 화면에 노출하지 않는다. */ }
  if (!response.ok && typeof problem === "object" && problem !== null
    && "detail" in problem && typeof problem.detail === "string" && problem.detail.length <= 300) {
    const seconds = "retryAfterSeconds" in problem ? problem.retryAfterSeconds : undefined;
    throw new AuthRequestError(problem.detail, response.status,
      typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined);
  }
  throw new AuthRequestError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", response.status);
}

export async function login(input: LoginInput): Promise<void> {
  await authMutation("/api/auth/login", input);
}

export async function logout(): Promise<void> {
  await authMutation("/api/auth/logout");
}
