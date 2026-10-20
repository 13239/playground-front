const channelName = "playground:auth-change";
const storageKey = "playground:auth-revision";
const localEvent = "playground:auth-change";

/** 변경 알림은 재조회 신호일 뿐이다. 토큰·세션 ID·사용자 정보는 채널이나 저장소에 넣지 않는다. */
export function notifyAuthChanged(): void {
  // 이 표식은 알림 중복 제거에만 사용하며 비밀값이나 인증 식별자가 아니다.
  const revision = `${Date.now()}:${Math.random()}`;
  window.dispatchEvent(new CustomEvent(localEvent, { detail: revision }));
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(revision);
    channel.close();
  } catch { /* 채널을 막는 브라우저도 storage 이벤트와 탭 복귀 시 재조회로 복구한다. */ }
  try {
    // 원격 HTTP에서도 동작하며 이 값은 인증이나 권한 판별에 사용하지 않는다.
    localStorage.setItem(storageKey, revision);
  } catch { /* 저장소를 사용할 수 없어도 로그인 성공을 실패로 바꾸지 않는다. */ }
}

/** 동일 문서·다른 탭의 알림을 구독한다. 알림 자체를 신뢰해 로그인 판별이나 쿠키 삭제를 수행하지 않는다. */
export function subscribeAuthChanges(listener: () => void): () => void {
  let lastRevision: string | undefined;
  const onRevision = (revision: unknown) => {
    if (typeof revision !== "string" || revision.length > 100 || revision === lastRevision) return;
    lastRevision = revision;
    listener();
  };
  const onLocal = (event: Event) => onRevision((event as CustomEvent<unknown>).detail);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) onRevision(event.newValue); };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = event => onRevision(event.data);
  } catch { /* 탭 복귀 확인과 storage 이벤트를 함께 사용한다. */ }
  window.addEventListener(localEvent, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.close();
    window.removeEventListener(localEvent, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
