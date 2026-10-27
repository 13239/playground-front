import { currentPasswordError } from "./password-validation";

export type AccountWithdrawalInput = Readonly<{ currentPassword: string }>;
export type AccountWithdrawalErrors = Partial<Record<keyof AccountWithdrawalInput, string>>;

/** 브라우저와 BFF는 같은 현재 비밀번호 검사만 공유하고 탈퇴 대상·상태는 입력으로 받지 않는다. */
export function validateAccountWithdrawal(value: unknown): AccountWithdrawalErrors {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const error = currentPasswordError(input.currentPassword);
  return error ? { currentPassword: error } : {};
}
