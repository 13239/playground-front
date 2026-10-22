import { AuthRequestError } from "./error";

type Cooldown = Readonly<{ until: number; error: AuthRequestError }>;
const proofStorageKey = "playground:auth-proof-retry-until";
const cooldowns = new Map<string, Cooldown>();
const proofScope = "browser-proof";

/** 재시도 간격은 서버의 대기 시간을 우선한다. 제한 응답에 시간이 없으면 60초 동안 재전송하지 않는다. */
export function authRetryDelay(error: unknown, fallback = 5000): number {
  if (!(error instanceof AuthRequestError)) return fallback;
  const seconds = error.retryAfterSeconds;
  if (seconds !== undefined && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400) return seconds * 1000;
  return error.status === 429 ? 60_000 : fallback;
}

// 로컬 차단을 서버의 새 제한 응답으로 오인해 매 클릭마다 대기 종료 시각을 연장하지 않는다.
class CooldownError extends AuthRequestError {}

/** 같은 문서의 모든 보호 API가 증명 예산을 공유한다. 저장소에는 탭 간 대기 시각만 넣고 인증 정보는 넣지 않는다. */
export function rememberAuthRateLimit(path: string, error: unknown): void {
  if (!(error instanceof AuthRequestError) || error.status !== 429 || error instanceof CooldownError) return;
  const scope = error.code === "BROWSER_PROOF_RATE_LIMIT_EXCEEDED" || path === "/api/auth/proof-challenge" ? proofScope : path;
  const until = Math.max(cooldowns.get(scope)?.until ?? 0, Date.now() + authRetryDelay(error));
  cooldowns.set(scope, { until, error });
  if (scope === proofScope) {
    try {
      // 다른 탭의 대기 시간을 줄이지 않는다. 이 표식은 요청 지연에만 쓰며 인증 판별에는 사용하지 않는다.
      const previous = Number(localStorage.getItem(proofStorageKey));
      localStorage.setItem(proofStorageKey, String(Math.max(until, Number.isFinite(previous) && previous <= Date.now() + 86_400_000 ? previous : 0)));
    } catch { /* 저장소가 차단돼도 현재 문서의 제한 대기는 유지한다. */ }
  }
}

/** 대기 중인 요청은 키 읽기·서명·네트워크 호출 전에 거절하고 남은 시간을 호출자에게 전달한다. */
export function assertAuthRequestAllowed(path: string): void {
  const now = Date.now();
  let blocking: Cooldown | undefined;
  for (const [scope, cooldown] of cooldowns) {
    if (cooldown.until <= now) cooldowns.delete(scope);
    else if ((scope === proofScope || scope === path) && cooldown.until > (blocking?.until ?? 0)) blocking = cooldown;
  }
  try {
    const until = Number(localStorage.getItem(proofStorageKey));
    if (Number.isFinite(until) && until > now && until <= now + 86_400_000 && until > (blocking?.until ?? 0)) {
      blocking = { until, error: new AuthRequestError("요청이 많아 잠시 기다리고 있어요. 잠시 후 다시 시도해 주세요.", 429, undefined, "BROWSER_PROOF_RATE_LIMIT_EXCEEDED") };
    }
  } catch { /* 탭 사이 공유가 불가능하면 현재 문서의 대기 시간만 사용한다. */ }
  if (blocking) throw new CooldownError(blocking.error.message, 429, Math.max(1, Math.ceil((blocking.until - now) / 1000)), blocking.error.code);
}
