import { signUpRules } from "./sign-up-validation";

export type PasswordChangeInput = Readonly<{ currentPassword: string; newPassword: string }>;
export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>;

/** 현재 비밀번호는 로그인 정책, 새 비밀번호는 가입 정책으로 검사하며 비밀번호 원문을 정규화하지 않는다. */
export function validatePasswordChange(value: unknown): PasswordChangeErrors {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const errors: PasswordChangeErrors = {};
  for (const field of ["currentPassword", "newPassword"] as const) {
    const text = input[field];
    const label = field === "currentPassword" ? "현재 비밀번호" : "새 비밀번호";
    const min = field === "currentPassword" ? 1 : signUpRules.password.min;
    if (typeof text !== "string" || /^[\p{Z}\t\n\v\f\r\u001c-\u001f]*$/u.test(text)) errors[field] = `${label}를 입력해 주세요.`;
    else if ([...text].length < min || [...text].length > signUpRules.password.max) errors[field] = `${label}는 ${min}~72자로 입력해 주세요.`;
  }
  if (!errors.newPassword && input.currentPassword === input.newPassword) errors.newPassword = "현재 비밀번호와 다르게 입력해 주세요.";
  return errors;
}
