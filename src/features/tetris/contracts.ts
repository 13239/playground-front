/** BFF와 브라우저가 공유하는 공개 계약이다. 서버 시드 외에 내부 계정·로그인 정보는 전달하지 않는다. */
export type TetrisRun = Readonly<{
  runId: string;
  seed: number;
  ruleVersion: number;
}>;
export type Ranking = Readonly<{
  rank: number;
  nickname: string;
  score: number;
  self: boolean;
}>;
export type Overview = Readonly<{
  bestScore: number;
  rank: number | null;
  plays: number;
  page: number;
  totalPages: number;
  rankings: Ranking[];
}>;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isRun(value: unknown): value is TetrisRun {
  return (
    object(value) &&
    typeof value.runId === "string" &&
    uuid.test(value.runId) &&
    nonnegative(value.seed) &&
    value.seed > 0 &&
    value.seed <= 0xffffffff &&
    value.ruleVersion === 1
  );
}
export function isOverview(value: unknown): value is Overview {
  return (
    object(value) &&
    nonnegative(value.bestScore) &&
    nonnegative(value.plays) &&
    (value.rank === null || (nonnegative(value.rank) && value.rank > 0)) &&
    nonnegative(value.page) &&
    nonnegative(value.totalPages) &&
    value.page >= 1 &&
    value.totalPages >= value.page &&
    value.totalPages <= 10 &&
    Array.isArray(value.rankings) &&
    value.rankings.length <= 10 &&
    value.rankings.every(
      (row, index) =>
        object(row) &&
        row.rank === (Number(value.page) - 1) * 10 + index + 1 &&
        typeof row.nickname === "string" &&
        row.nickname.length <= 50 &&
        nonnegative(row.score) &&
        typeof row.self === "boolean",
    )
  );
}
