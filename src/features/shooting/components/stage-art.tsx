import { useId } from "react";
import {
  STAGE_MAPS,
  stageLayout,
  type StageMapId,
} from "@playground/shooting-shared";
import styles from "./stage-mode.module.css";

/** 카드와 전장이 같은 몬스터 원화를 사용한다. 한 번 받은 아틀라스를 셀별로 재사용한다. */
export function AtlasArt({
  mapId,
  frame = 4,
  className = "",
}: {
  mapId: StageMapId;
  frame?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.atlasArt} ${className}`}
      style={{
        backgroundImage: `url(/images/shooting/stage-v3/${STAGE_MAPS[mapId].theme}.png)`,
        backgroundPosition: `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`,
      }}
    />
  );
}

/** 실제 맵의 통로 배치를 축소해 보여 주므로 전투와 다른 장식용 지도에 속지 않는다. */
export function MapPreview({ mapId }: { mapId: StageMapId }) {
  const pattern = useId(),
    map = STAGE_MAPS[mapId],
    layout = stageLayout(mapId, 1);
  const colors =
    mapId === "CAVE"
      ? ["#8d82b7", "#b7a9d6", "#675b8a"]
      : mapId === "FACTORY"
        ? ["#b5a5b9", "#ead1a2", "#8a758f"]
        : ["#a2c8b2", "#c7e0b6", "#63967f"];
  return (
    <svg
      viewBox="0 0 1600 960"
      role="img"
      aria-label={`${map.name} 지형과 몬스터`}
      className={styles.mapPreview}
    >
      <defs>
        <pattern
          id={pattern}
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <rect width="100" height="100" rx="14" fill={colors[0]} />
          <path
            d="M0 98h100M98 0v100"
            stroke={colors[2]}
            strokeOpacity=".2"
            strokeWidth="3"
          />
        </pattern>
      </defs>
      <rect width="1600" height="960" fill={`url(#${pattern})`} />
      {layout.walls.map((wall, index) => (
        <g key={index}>
          <rect {...wall} y={wall.y + 15} rx="20" fill={colors[2]} />
          <rect
            {...wall}
            rx="20"
            fill={colors[1]}
            stroke={colors[2]}
            strokeWidth="9"
          />
        </g>
      ))}
      {[
        { x: 80, y: 150, f: 0 },
        { x: 1120, y: 490, f: 2 },
        { x: 650, y: 340, f: 5 },
      ].map((item, index) => (
        <svg
          key={index}
          x={item.x}
          y={item.y}
          width="290"
          height="290"
          viewBox={`${(item.f % 3) * 512} ${Math.floor(item.f / 3) * 512} 512 512`}
        >
          <image
            href={`/images/shooting/stage-v3/${map.theme}.png`}
            width="1536"
            height="1024"
          />
        </svg>
      ))}
    </svg>
  );
}

export function Stars({
  value,
  large = false,
}: {
  value: number;
  large?: boolean;
}) {
  return (
    <span
      className={`${styles.stars} ${large ? styles.starsLarge : ""}`}
      role="img"
      aria-label={`별 3개 중 ${value}개`}
    >
      {[1, 2, 3].map((star) => (
        <span aria-hidden="true" key={star} data-filled={star <= value}>
          ★
        </span>
      ))}
    </span>
  );
}
