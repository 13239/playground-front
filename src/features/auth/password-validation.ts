import { signUpRules } from "./sign-up-validation";

export type PasswordChangeInput = Readonly<{ currentPassword: string; newPassword: string }>;
export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>;

/** 비밀번호 변경·회원탈퇴의 본인 확인은 같은 기존 비밀번호 길이와 공백 규칙을 사용한다. 원문은 정규화하지 않는다. */
export function currentPasswordError(value: unknown): string | undefined {
  if (typeof value !== "string" || /^[\p{Z}\t\n\v\f\r\u001c-\u001f]*$/u.test(value)) return "현재 비밀번호를 입력해 주세요.";
  if ([...value].length > signUpRules.password.max) return "현재 비밀번호는 1~72자로 입력해 주세요.";
}

/** 현재 비밀번호는 로그인 정책, 새 비밀번호는 가입 정책으로 검사하며 비밀번호 원문을 정규화하지 않는다. */
export function validatePasswordChange(value: unknown): PasswordChangeErrors {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const errors: PasswordChangeErrors = {};
  const currentError = currentPasswordError(input.currentPassword);
  if (currentError) errors.currentPassword = currentError;
  // 기존 비밀번호 검사는 탈퇴와 공유하고 새 비밀번호의 가입 정책은 그대로 유지한다.
  const nextPassword = input.newPassword;
  if (typeof nextPassword !== "string" || /^[\p{Z}\t\n\v\f\r\u001c-\u001f]*$/u.test(nextPassword)) errors.newPassword = "새 비밀번호를 입력해 주세요.";
  else if ([...nextPassword].length < signUpRules.password.min || [...nextPassword].length > signUpRules.password.max) errors.newPassword = `새 비밀번호는 ${signUpRules.password.min}~72자로 입력해 주세요.`;
  if (!errors.newPassword && input.currentPassword === input.newPassword) errors.newPassword = "현재 비밀번호와 다르게 입력해 주세요.";
  return errors;
}
