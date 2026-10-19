import "server-only";

import type { LoginInput } from "../types";
import { ApiError } from "@/lib/server/api-error";

/** Spring 로그인 DTO와 같은 필수값·길이를 검사하고 아이디·비밀번호 원문은 변경하지 않는다. */
export function parseLoginInput(value: unknown): LoginInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  const input = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  // Java StringValid와 동일하게 UTF-16 코드 단위가 아닌 Unicode 코드 포인트로 길이를 센다.
  if (typeof input.username !== "string" || !input.username.trim() || [...input.username].length > 50) {
    fields.username = "아이디를 1~50자로 입력해 주세요.";
  }
  if (typeof input.password !== "string" || !input.password.trim() || [...input.password].length > 72) {
    fields.password = "비밀번호를 1~72자로 입력해 주세요.";
  }
  if (typeof input.keepLoggedIn !== "boolean") fields.keepLoggedIn = "로그인 유지 여부를 선택해 주세요.";
  if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", { fieldErrors: fields });
  // 검사한 공개 계약의 필드만 Spring에 전달하며 알 수 없는 추가 필드는 버린다.
  return { username: input.username as string, password: input.password as string, keepLoggedIn: input.keepLoggedIn as boolean };
}
