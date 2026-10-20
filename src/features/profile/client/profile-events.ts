const eventName = "playground:profile-change";

/** 프로필 변경은 로그인 변경과 분리한다. 계정·세션 정보 없이 재조회 신호만 보내 헤더를 비우지 않는다. */
export function notifyProfileChanged(): void {
  const revision = `${Date.now()}:${Math.random()}`;
  window.dispatchEvent(new CustomEvent(eventName, { detail: revision }));
  try {
    const channel = new BroadcastChannel(eventName);
    channel.postMessage(revision);
    channel.close();
  } catch { /* 채널을 사용할 수 없으면 다른 탭은 포커스를 되찾을 때 프로필을 다시 조회한다. */ }
}

export function subscribeProfileChanges(listener: () => void): () => void {
  let lastRevision: string | undefined;
  const onRevision = (value: unknown) => {
    if (typeof value !== "string" || value.length > 100 || value === lastRevision) return;
    lastRevision = value;
    listener();
  };
  const onLocal = (event: Event) => onRevision((event as CustomEvent<unknown>).detail);
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(eventName);
    channel.onmessage = (event) => onRevision(event.data);
  } catch { /* 저장을 실패 처리하거나 로그인 상태를 변경하지 않고 탭 복귀 확인을 사용한다. */ }
  window.addEventListener(eventName, onLocal);
  return () => {
    channel?.close();
    window.removeEventListener(eventName, onLocal);
  };
}
