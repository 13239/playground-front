/** DB의 임의 URL을 실행하지 않는다. 새 게임 배포 때 코드별 화면 연결을 명시적으로 추가한다. */
export function gameHref(code: string): `/games/${string}` | undefined {
  // 배포된 오목·테트리스·같은 그림 찾기·슈팅만 명시적으로 연결하고 DB에서 임의 경로를 실행하지 않는다.
  const paths: Readonly<Record<string, `/games/${string}`>> = { GOMOKU: "/games/gomoku", TETRIS: "/games/tetris", MEMORY: "/games/memory", SHOOTING: "/games/shooting" };
  return Object.hasOwn(paths, code) ? paths[code] : undefined;
}
