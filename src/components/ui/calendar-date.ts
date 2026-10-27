/** 날짜만 다루는 공통 연산은 UTC를 사용해 시간대·서머타임 때문에 날짜가 바뀌지 않게 한다. */
function date(year: number, month: number, day: number) {
  const value = new Date(0); value.setUTCFullYear(year, month - 1, day); value.setUTCHours(0, 0, 0, 0); return value;
}
export function isoDate(value: Date) {
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}
export function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number), parsed = date(year, month, day);
  return year >= 1 && isoDate(parsed) === value ? parsed : null;
}
export function todayDate() {
  const now = new Date(); return isoDate(date(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}
export function addDays(value: string, amount: number) {
  // 달력 가장자리의 이전·다음 달 표시에만 쓰는 0000/10000년 계산도 허용하고 선택 가능 여부는 별도로 검사한다.
  const [year, month, day] = value.split("-").map(Number), parsed = parseDate(value) ?? date(year, month, day);
  parsed.setUTCDate(parsed.getUTCDate() + amount); return isoDate(parsed);
}
export function addMonths(value: string, amount: number) {
  const parsed = parseDate(value)!, index = Math.max(12, Math.min(119999, parsed.getUTCFullYear() * 12 + parsed.getUTCMonth() + amount));
  const year = Math.floor(index / 12), month = index % 12 + 1;
  return isoDate(date(year, month, Math.min(parsed.getUTCDate(), date(year, month + 1, 0).getUTCDate())));
}
export function clampDate(value: string, min = "0001-01-01", max = "9999-12-31") {
  // 마지막 주에서 10000년으로 이동한 내부 계산도 지원 범위로 되돌린 뒤 고정 길이 ISO 값을 비교한다.
  const year = Number(value.split("-")[0]);
  return year < 1 || value < min ? min : year > 9999 || value > max ? max : value;
}
export function dateError(value: string, min?: string, max?: string, required?: boolean) {
  if (!value) return required ? "날짜를 입력해 주세요." : "";
  if (!parseDate(value)) return "YYYY-MM-DD 형식의 올바른 날짜를 입력해 주세요.";
  if (min && value < min) return `${min} 이후 날짜를 선택해 주세요.`;
  if (max && value > max) return `${max} 이전 날짜를 선택해 주세요.`;
  return "";
}
