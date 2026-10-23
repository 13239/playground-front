import { isAiDifficulty, isAiPosition, isAiRule, type AiSearchRequest, type AiSearchResponse } from "./contracts";
import { chooseAiMove } from "./engine";

// 브라우저 UI·인증·네트워크와 분리된 전용 워커에서만 CPU 탐색을 실행한다.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AiSearchRequest>) => void) | null;
  postMessage: (message: AiSearchResponse) => void;
};
scope.onmessage = event => {
  const request = event.data;
  // 워커에서도 규칙과 흑의 참가자 번호를 검증해 재대국의 흑백 교대를 탐색에 그대로 적용한다.
  if (!request || !Number.isSafeInteger(request.requestId) || !isAiDifficulty(request.difficulty) || !isAiPosition(request.moves)
    || !isAiRule(request.rule) || request.blackSeat !== 1 && request.blackSeat !== 2) return;
  try {
    const result = chooseAiMove(request.moves, request.difficulty, 2, { rule: request.rule, blackSeat: request.blackSeat });
    scope.postMessage(result ? { requestId: request.requestId, ok: true, ...result } : { requestId: request.requestId, ok: false });
  } catch {
    scope.postMessage({ requestId: request.requestId, ok: false });
  }
};
