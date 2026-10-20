/** SSR이 전달한 dev 표시만 읽는다. 표시가 없으면 개인키 검증을 요구하고 서버 검증을 완화하지 않는다. */
export function isDevHttpAuth(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.authMode === "dev-http";
}
