/** DB의 임의 URL을 실행하지 않는다. 새 게임 배포 때 코드별 화면 연결을 명시적으로 추가한다. */
export function gameHref(code: string): `/games/${string}` | undefined {
  return code === "GOMOKU" ? "/games/gomoku" : undefined;
}
