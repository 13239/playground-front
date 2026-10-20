import type { CSSProperties } from "react";
import styles from "./lobby.module.css";

const stones = [
  { x: 3, y: 2, white: false },
  { x: 4, y: 2, white: true },
  { x: 4, y: 3, white: false },
  { x: 5, y: 3, white: true },
  { x: 3, y: 4, white: true },
  { x: 4, y: 4, white: false },
  { x: 5, y: 5, white: false },
  { x: 6, y: 4, white: true },
] as const;

/** 오목 표지는 이미지 다운로드 없이 CSS 바둑판·돌로 그리며, 게임 규칙이나 착수 처리는 포함하지 않는다. */
export function GomokuCover() {
  return (
    <div className={styles.gomokuCover} aria-hidden="true">
      <span className={styles.boardGlow} />
      <div className={styles.miniBoard}>
        {stones.map((stone) => (
          <span
            key={`${stone.x}-${stone.y}`}
            className={`${styles.stone} ${stone.white ? styles.whiteStone : styles.blackStone}`}
            style={
              { "--stone-x": stone.x, "--stone-y": stone.y } as CSSProperties
            }
          />
        ))}
      </div>
      <span className={styles.blossom}>✿</span>
      <span className={styles.blossomSmall}>✿</span>
      <span className={styles.coverCaption}>한 수의 즐거움</span>
    </div>
  );
}
