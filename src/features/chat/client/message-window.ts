import type { PublicChatMessage } from "./protocol";

export const MAX_VISIBLE_MESSAGES = 500;

/** 시간 문자열의 소수점 자릿수와 무관하게 비교하고 같은 시각은 DB ID로 안정적으로 정렬한다. */
function compareMessages(a: PublicChatMessage, b: PublicChatMessage): number {
  const millis = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  // 서버의 마이크로초 시각도 보존한다. Date.parse만 사용하면 같은 밀리초 안의 순서가 사라진다.
  const fraction = (value: string) => (value.match(/\.(\d+)Z$/)?.[1] ?? "").padEnd(9, "0");
  return millis || fraction(a.createdAt).localeCompare(fraction(b.createdAt)) || a.id.localeCompare(b.id);
}

/** 과거 탐색은 앞쪽, 실시간 화면은 뒤쪽을 남긴다. 500개 상한 때문에 새로 받은 과거 페이지를 버리지 않는다. */
export function mergeMessages(current: readonly PublicChatMessage[], incoming: readonly PublicChatMessage[],
  keep: "oldest" | "latest" = "latest"): PublicChatMessage[] {
  const unique = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  const sorted = [...unique.values()].sort(compareMessages);
  return keep === "oldest" ? sorted.slice(0, MAX_VISIBLE_MESSAGES) : sorted.slice(-MAX_VISIBLE_MESSAGES);
}
