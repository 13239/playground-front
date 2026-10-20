import type { SignUpField, SignUpFieldErrors, SignUpInput } from "./types";

/** Spring SignUpRequest의 코드 포인트 길이 정책을 브라우저와 BFF에서 함께 사용한다. */
export const signUpRules = {
  nickname: { label: "닉네임", min: 1, max: 50 },
  username: { label: "아이디", min: 4, max: 50 },
  password: { label: "비밀번호", min: 6, max: 72 },
} as const;

type ValidationResult = Readonly<
  | { valid: true; input: SignUpInput }
  | { valid: false; errors: SignUpFieldErrors }
>;

/** 입력 원문은 정규화하거나 잘라내지 않는다. 허용한 세 필드만 반환하고 오류에는 입력값을 포함하지 않는다. */
export function validateSignUpInput(value: unknown): ValidationResult {
  const input = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const errors: Partial<Record<SignUpField, string>> = {};
  for (const field of Object.keys(signUpRules) as SignUpField[]) {
    const rule = signUpRules[field];
    const text = input[field];
    // Java Character.isWhitespace/isSpaceChar와 같은 공백 범위를 사용한다.
    if (typeof text !== "string" || /^[\p{Z}\t\n\v\f\r\u001c-\u001f]*$/u.test(text)) {
      errors[field] = `${rule.label} 입력이 필요합니다.`;
    } else if ([...text].length < rule.min || [...text].length > rule.max) {
      errors[field] = `${rule.label}: ${rule.min}~${rule.max}자로 입력해 주세요.`;
    }
  }
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, input: { nickname: input.nickname as string, username: input.username as string, password: input.password as string } };
}
