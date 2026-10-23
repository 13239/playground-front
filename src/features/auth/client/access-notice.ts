import { parseAccessNotice } from "../access-notice";

const key = "playground:access-notice";
export const accessNoticeEvent = "playground:access-restricted";
let current: { message: string; expiresAt: number } | undefined;

/** 강제 로그아웃 후 문서를 새로 열어도 짧은 운영 안내를 유지한다. 인증 정보는 저장하지 않는다. */
export function readAccessNotice(): string | undefined {
  try {
    if (!current) {
      const raw = sessionStorage.getItem(key);
      const value: unknown = raw && raw.length <= 1000 ? JSON.parse(raw) : undefined;
      if (typeof value === "object" && value !== null && "message" in value && "expiresAt" in value
        && parseAccessNotice(value.message) && typeof value.expiresAt === "number") {
        current = { message: value.message as string, expiresAt: value.expiresAt };
      }
    }
  } catch { /* 저장소가 없어도 같은 문서의 메모리 안내를 사용한다. */ }
  return current && current.expiresAt > Date.now() ? current.message : undefined;
}

export function rememberAccessNotice(message: string): void {
  const notice = parseAccessNotice(message);
  if (!notice || readAccessNotice() === notice) return;
  current = { message: notice, expiresAt: Date.now() + 15 * 60_000 };
  try { sessionStorage.setItem(key, JSON.stringify(current)); } catch { /* 안내 저장 실패로 인증 오류를 덮지 않는다. */ }
  // 같은 탭의 보호 화면도 다음 폴링을 기다리지 않고 계정 정보를 비운다.
  window.dispatchEvent(new Event(accessNoticeEvent));
}

/** 정상 세션 확인 또는 새 로그인 성공 시 이전 운영 안내를 제거한다. */
export function clearAccessNotice(): void {
  current = undefined;
  try { sessionStorage.removeItem(key); } catch { /* 메모리 안내도 함께 제거한다. */ }
}
