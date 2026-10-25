import {
  AuthRequestError,
  requestAuthenticatedApi,
} from "@/features/auth/client/api";
import { isOverview, isRun, type Overview, type TetrisRun } from "../contracts";
import type { ReplayInput } from "../engine/rules";

/** 응답의 공개 로그인 식별자까지 대조해 이전 계정의 늦은 기록을 표시하지 않는다. */
async function request(
  operation: "overview" | "start" | "finish",
  sessionId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await requestAuthenticatedApi(
    `/api/tetris/${operation}`,
    { sessionId, ...body },
    signal,
  );
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("sessionId" in value) ||
    value.sessionId !== sessionId
  )
    throw new AuthRequestError("게임 응답을 확인하지 못했습니다.", 502);
  return value;
}
export async function readOverview(
  sessionId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<Overview> {
  const value = await request("overview", sessionId, { page }, signal);
  if (!isOverview(value))
    throw new AuthRequestError("기록을 확인하지 못했습니다.", 502);
  return value;
}
export async function startRun(
  sessionId: string,
  requestId: string,
): Promise<TetrisRun> {
  const value = await request("start", sessionId, { requestId });
  if (!isRun(value))
    throw new AuthRequestError("게임 시작을 확인하지 못했습니다.", 502);
  return value;
}
export async function finishRun(
  sessionId: string,
  runId: string,
  ticks: number,
  inputs: ReplayInput[],
): Promise<Overview> {
  const value = await request("finish", sessionId, { runId, ticks, inputs });
  if (!isOverview(value))
    throw new AuthRequestError("기록 저장을 확인하지 못했습니다.", 502);
  return value;
}
