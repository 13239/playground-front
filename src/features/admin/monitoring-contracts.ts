/** 대시보드·상태 조회는 각각의 권한과 표시 필드만 사용한다. 수집 누락을 숫자 0으로 대체하지 않는다. */
export type DashboardPeriod = "TODAY" | "WEEK" | "MONTH";
export type MetricState = "READY" | "COLLECTING" | "UNKNOWN";
export type ConnectionPeak = Readonly<{ at: string; peak: number | null }>;
export type Dashboard = Readonly<{ period: DashboardPeriod; checkedAt: string; onlineState: MetricState; onlineCount: number | null;
  onlineCheckedAt: string | null; newMembers: number | null; historyState: MetricState | "DELAYED"; historyCheckedAt: string | null; points: readonly ConnectionPeak[] }>;
export type ServiceState = "NORMAL" | "DELAYED" | "DOWN" | "UNKNOWN";
export type ServiceStatus = Readonly<{ code: "LOGIN" | "GAME" | "CHAT"; state: ServiceState; checkedAt: string | null }>;
export type ServiceStatuses = Readonly<{ checkedAt: string; services: readonly ServiceStatus[] }>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number | null => value === null || typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const metricState = (value: unknown): value is MetricState => value === "READY" || value === "COLLECTING" || value === "UNKNOWN";
function assert(value: unknown): asserts value { if (!value) throw new Error("Invalid admin monitoring response"); }
export function parseDashboard(value: unknown): Dashboard {
  assert(object(value) && (value.period === "TODAY" || value.period === "WEEK" || value.period === "MONTH") && instant(value.checkedAt)
    && metricState(value.onlineState) && count(value.onlineCount) && (value.onlineCheckedAt === null || instant(value.onlineCheckedAt))
    && count(value.newMembers) && (metricState(value.historyState) || value.historyState === "DELAYED")
    && (value.historyCheckedAt === null || instant(value.historyCheckedAt)) && Array.isArray(value.points));
  assert(value.onlineState === "READY" ? value.onlineCount !== null && value.onlineCheckedAt !== null : value.onlineCount === null);
  const expected = value.period === "TODAY" ? Number(kstPart(value.checkedAt, "hour")) + 1 : value.period === "WEEK" ? 7 : 30;
  assert(value.points.length === expected);
  const period = value.period, checkedAt = value.checkedAt;
  const day = Date.UTC(Number(kstPart(checkedAt, "year")), Number(kstPart(checkedAt, "month")) - 1, Number(kstPart(checkedAt, "day"))) - 9 * 3600000;
  const first = day - (period === "TODAY" ? 0 : (expected - 1) * 86400000);
  const points = value.points.map((item, index) => {
    assert(object(item) && instant(item.at) && count(item.peak));
    const at = Date.parse(item.at), step = period === "TODAY" ? 3600000 : 86400000;
    assert(at <= Date.parse(checkedAt) && at === first + index * step);
    return { at: item.at, peak: item.peak };
  });
  const measured = points.some(point => point.peak !== null);
  assert(value.historyState === "READY" || value.historyState === "DELAYED"
    ? measured && value.historyCheckedAt !== null : !measured);
  return { period: value.period, checkedAt: value.checkedAt, onlineState: value.onlineState, onlineCount: value.onlineCount,
    onlineCheckedAt: value.onlineCheckedAt, newMembers: value.newMembers, historyState: value.historyState, historyCheckedAt: value.historyCheckedAt, points };
}
export function parseServiceStatuses(value: unknown): ServiceStatuses {
  assert(object(value) && instant(value.checkedAt) && Array.isArray(value.services) && value.services.length === 3);
  const seen = new Set<string>();
  const services = value.services.map((item): ServiceStatus => {
    assert(object(item) && (item.code === "LOGIN" || item.code === "GAME" || item.code === "CHAT") && !seen.has(item.code)
      && (item.state === "NORMAL" || item.state === "DELAYED" || item.state === "DOWN" || item.state === "UNKNOWN")
      && (item.checkedAt === null || instant(item.checkedAt)) && (item.state === "UNKNOWN" || item.checkedAt !== null));
    seen.add(item.code); return { code: item.code, state: item.state, checkedAt: item.checkedAt };
  });
  return { checkedAt: value.checkedAt, services };
}

// 모든 화면은 사용자 PC의 시간대와 무관하게 서버의 KST 날짜 경계를 사용한다.
const dateParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function kstPart(value: string, type: Intl.DateTimeFormatPartTypes) { return dateParts.formatToParts(new Date(value)).find(part => part.type === type)!.value; }
export const monitoringDate = (value: string) => `${kstPart(value, "year")}.${kstPart(value, "month")}.${kstPart(value, "day")}`;
export const chartLabel = (value: string, hourly: boolean) => hourly ? `${kstPart(value, "hour")}시` : `${kstPart(value, "month")}/${kstPart(value, "day")}`;
const numbers = new Intl.NumberFormat("ko-KR");
export const metricNumber = (value: number) => numbers.format(value);
