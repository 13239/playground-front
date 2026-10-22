type DeviceNavigator = Navigator & { userAgentData?: { mobile: boolean; platform: string } };

// 팝업은 원본 문서의 대국 UI만 표시한다. 같은 방의 연결과 재접속 상태는 원본에 한 번만 둔다.
let activePopup: Window | null = null;
const listeners = new Set<() => void>();

/** 화면 폭으로 기기를 구분하지 않아 작은 데스크톱 창도 허용하고 데스크톱 모드의 iPad도 제외한다. */
export function supportsGamePopup(): boolean {
  if (typeof window === "undefined" || typeof window.open !== "function") return false;
  const device = navigator as DeviceNavigator;
  if (device.userAgentData?.mobile || /Android|iOS/i.test(device.userAgentData?.platform ?? "")) return false;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook/i.test(device.userAgent)) return false;
  if (/Mac/i.test(device.platform) && device.maxTouchPoints > 1) return false;
  // 터치가 주 입력인 Windows 태블릿도 제외한다. 터치 지원 노트북의 마우스 입력은 허용한다.
  return !window.matchMedia("(pointer: coarse)").matches;
}

export function getGamePopup(): Window | null {
  return activePopup && !activePopup.closed ? activePopup : null;
}

/** 팝업 전환을 구독해 서버 연결을 다시 만들지 않고 창의 포커스와 타이머만 인계한다. */
export function subscribeToGamePopup(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function registerGamePopup(popup: Window): () => void {
  activePopup = popup;
  listeners.forEach(listener => listener());
  return () => {
    // 늦게 닫힌 이전 창은 새 대국의 팝업 등록을 해제하지 못한다.
    if (activePopup !== popup) return;
    activePopup = null;
    listeners.forEach(listener => listener());
  };
}

/** 원본 탭을 숨겨도 팝업 창의 시계·접속 확인을 사용한다. */
export function getGameDisplayWindow(): Window {
  return getGamePopup() ?? window;
}
