/** 관리자가 작성한 운영 안내만 평문으로 공개한다. 인증·게임 경계가 같은 검증을 공유한다. */
export function parseOperationalNotice(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 300 && value.trim().length > 0
    && !/[\p{Cc}\p{Cf}]/u.test(value) ? value : undefined;
}
