import type { SignUpInput } from "../types";
import { AuthRequestError, requireSuccess } from "./error";

/** 가입 정보는 동일 Origin BFF로 한 번만 전송한다. 네트워크 실패 후 중복 계정을 만들 수 있는 자동 재시도는 하지 않는다. */
export async function signUp(input: SignUpInput): Promise<void> {
  try {
    const response = await requireSuccess(await fetch("/api/auth/sign-up", {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(35_000), headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: input.nickname, username: input.username, password: input.password }),
    }));
    if (response.status !== 201) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError("가입 결과를 확인하지 못했습니다. 잠시 후 다시 시도하거나 로그인해 주세요.", 0);
  }
}
