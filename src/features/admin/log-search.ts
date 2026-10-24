/** 로그의 날짜는 서버와 같은 한국 시각으로 계산하고 브라우저의 지역 시간대에 의존하지 않는다. */
function koreanDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (kind: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === kind)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export type LogFilters = Readonly<{ from: string; to: string; query: string; type: string; result: string; targetType: string }>;
export function defaultLogFilters(): LogFilters {
  const now = Date.now();
  return { from: koreanDate(new Date(now - 6 * 86400000)), to: koreanDate(new Date(now)), query: "", type: "", result: "", targetType: "" };
}
/** BFF에서도 실제 달력 날짜와 DB가 지원하는 범위를 검사한다. 2월 30일 같은 자동 보정은 허용하지 않는다. */
export function isLogDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1000-01-01" || value > "9999-12-30") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
