import { signUpRules } from "@/features/auth/sign-up-validation";

/** 가입과 같은 코드 포인트 길이·공백 검사를 브라우저와 BFF에서 공유하고 입력 원문은 바꾸지 않는다. */
export function nicknameError(value: unknown): string | undefined {
  if (typeof value !== "string" || /^[\p{Z}\t\n\v\f\r\u001c-\u001f]*$/u.test(value)) return "닉네임을 입력해 주세요.";
  if ([...value].length > signUpRules.nickname.max) return "닉네임은 50자 이하로 입력해 주세요.";
}
