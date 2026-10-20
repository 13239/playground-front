import "server-only";

import { unstable_rethrow } from "next/navigation";

// 백엔드 원문 오류 대신 허용한 상태·메시지만 브라우저에 제공한다.
const errors = {
  VALIDATION_FAILED: [400, "입력값이 올바르지 않습니다."],
  INVALID_REQUEST_BODY: [400, "요청 본문의 형식 또는 값이 올바르지 않습니다."],
  PAYLOAD_TOO_LARGE: [413, "요청 본문이 너무 큽니다."],
  UNSUPPORTED_MEDIA_TYPE: [415, "JSON 형식으로 요청해 주세요."],
  DUPLICATE_USERNAME: [409, "이미 사용 중인 아이디입니다."],
  // 오목 방의 충돌과 일시적인 생성 실패를 내부 DB 오류 없이 구분한다.
  ROOM_ALREADY_HOSTING: [409, "이미 만든 방이 있습니다. 목록에서 내 방을 확인해 주세요."],
  ROOM_REQUEST_EXPIRED: [409, "이미 닫힌 방의 요청입니다. 새로 방을 만들어 주세요."],
  ROOM_NOT_FOUND: [404, "방을 찾을 수 없습니다."],
  ROOM_CANNOT_CLOSE: [409, "다른 참가자가 있거나 대국 중인 방은 닫을 수 없습니다."],
  ROOM_CODE_UNAVAILABLE: [503, "방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ROOM_RATE_LIMIT_EXCEEDED: [429, "방 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  ROOM_SERVICE_UNAVAILABLE: [503, "오목 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  // 가입 전용 제한·장애는 로그인 실패나 계정 잠금으로 표시하지 않는다.
  SIGN_UP_RATE_LIMIT_EXCEEDED: [429, "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  SIGN_UP_SERVICE_UNAVAILABLE: [503, "회원가입 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  USER_NOT_FOUND: [404, "사용자를 찾을 수 없습니다."],
  INVALID_CREDENTIALS: [401, "아이디 또는 비밀번호가 올바르지 않습니다."],
  INVALID_REFRESH_TOKEN: [401, "로그인이 만료되었습니다. 다시 로그인해 주세요."],
  // 서버에서 해당 세션을 폐기했음을 전달하며 지연 응답으로 다른 요청의 새 쿠키를 삭제하지 않는다.
  REFRESH_TOKEN_REUSED: [401, "인증 정보 재사용이 감지되어 로그인 세션을 종료했습니다. 다시 로그인해 주세요."],
  INVALID_SESSION: [401, "로그인이 만료되었습니다. 다시 로그인해 주세요."],
  BROWSER_KEY_REQUIRED: [401, "이 브라우저의 로그인 키를 확인할 수 없습니다. 다시 로그인해 주세요."],
  BROWSER_PROOF_INVALID: [403, "요청의 브라우저 인증 정보를 확인할 수 없습니다."],
  BROWSER_PROOF_EXPIRED: [403, "요청 인증 정보가 만료되었습니다. 다시 시도해 주세요."],
  BROWSER_PROOF_REPLAYED: [403, "이미 처리한 요청 인증 정보입니다. 다시 시도해 주세요."],
  BROWSER_PROOF_RATE_LIMIT_EXCEEDED: [429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  BFF_AUTHENTICATION_REQUIRED: [403, "허용되지 않은 서버 연결입니다."],
  // 충돌 응답은 먼저 성공한 요청이 설정한 인증 쿠키를 유지하며 재시도를 안내한다.
  LOGIN_SESSION_CHANGED: [409, "로그인 상태가 변경되었습니다. 현재 상태를 다시 확인해 주세요."],
  LOGIN_RATE_LIMIT_EXCEEDED: [429, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  AUTH_SERVICE_UNAVAILABLE: [503, "로그인 서비스를 일시적으로 이용할 수 없습니다."],
  INVALID_AUTHENTICATION_REQUEST: [400, "인증 요청 형식이 올바르지 않습니다."],
  AUTHENTICATION_REQUIRED: [401, "로그인이 필요합니다."],
  INVALID_ACCESS_TOKEN: [401, "인증 정보를 갱신해야 합니다."],
  SESSION_REFRESH_REQUIRED: [401, "로그인 상태를 갱신해야 합니다."],
  ACCESS_DENIED: [403, "접근 권한이 없습니다."],
  INVALID_ORIGIN: [403, "허용되지 않은 요청입니다."],
  BACKEND_UNAVAILABLE: [503, "서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  BACKEND_TIMEOUT: [504, "응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."],
  INVALID_BACKEND_RESPONSE: [502, "서비스 응답을 처리할 수 없습니다."],
  SERVER_CONFIGURATION_ERROR: [500, "서버 설정을 확인할 수 없습니다."],
  INTERNAL_ERROR: [500, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."],
} as const;

type ErrorDetails = Readonly<{
  fieldErrors?: Readonly<Record<string, string>>;
  retryAfterSeconds?: number;
}>;

/** 요청 실패와 인증 만료를 구분하며 토큰·내부 주소·예외 원문을 보관하지 않는다. */
export class ApiError extends Error {
  readonly code: keyof typeof errors;
  readonly status: number;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly retryAfterSeconds?: number;

  constructor(code: keyof typeof errors, details: ErrorDetails = {}) {
    const [status, message] = errors[code];
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = details.fieldErrors;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

// 필드 오류는 평범한 객체의 짧은 문자열만 허용하여 응답 크기와 형태를 제한한다.
function parseFieldErrors(value: unknown): ErrorDetails["fieldErrors"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(value).slice(0, 20)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(key) && typeof message === "string" && message.length <= 300) {
      fields[key] = message;
    }
  }
  return fields;
}

/** Spring의 ProblemDetail을 제한된 공개 오류 정보로 변환한다. */
export function parseBackendError(
  status: number,
  body: unknown,
  retryAfter: string | null,
): ApiError {
  if (
    typeof body === "object" && body !== null && "code" in body
    && typeof body.code === "string" && Object.hasOwn(errors, body.code)
  ) {
    const code = body.code as keyof typeof errors;
    if (errors[code][0] === status) {
      const fields = "errors" in body ? body.errors : undefined;
      const fieldErrors = code === "VALIDATION_FAILED" ? parseFieldErrors(fields) : undefined;
      const seconds = retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : undefined;
      return new ApiError(code, {
        fieldErrors,
        retryAfterSeconds: status === 429 && seconds && seconds <= 86_400 ? seconds : undefined,
      });
    }
  }
  return new ApiError(status >= 500 ? "BACKEND_UNAVAILABLE" : "INVALID_BACKEND_RESPONSE");
}

/** Route Handler에서만 사용하며 알 수 없는 예외의 메시지·스택은 응답에 포함하지 않는다. */
export function apiErrorResponse(error: unknown): Response {
  // cookies·no-store 접근으로 생긴 Next.js의 렌더링 제어 예외는 일반 500 응답으로 삼키지 않는다.
  unstable_rethrow(error);
  const failure = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR");
  const headers = new Headers({
    "Content-Type": "application/problem+json",
    "Cache-Control": "no-store",
  });
  if (failure.retryAfterSeconds) {
    headers.set("Retry-After", String(failure.retryAfterSeconds));
  }
  return Response.json(
    {
      type: "about:blank",
      title: failure.code,
      status: failure.status,
      detail: failure.message,
      code: failure.code,
      ...(failure.fieldErrors && { errors: failure.fieldErrors }),
      ...(failure.retryAfterSeconds && { retryAfterSeconds: failure.retryAfterSeconds }),
    },
    { status: failure.status, headers },
  );
}
