import { cells, COLORS } from "../engine/rules";

/** 홀드·다음 블록은 작은 SVG로 그려 React 영역에 추가 엔진이나 캔버스를 만들지 않는다. 게임판과 같은 진한 채움으로 표시한다. */
export function PiecePreview({ type }: { type: number }) {
  if (!type) return <span aria-label="보관한 블록 없음">—</span>;
  const points = cells(type),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = Math.max(...xs) - minX + 1,
    height = Math.max(...ys) - minY + 1;
  const color = `#${COLORS[type].toString(16).padStart(6, "0")}`;
  return (
    <svg
      viewBox={`-5 -5 ${width * 24 + 10} ${height * 24 + 10}`}
      aria-label={`${["", "I", "O", "T", "J", "L", "S", "Z"][type]} 블록`}
      role="img"
    >
      {points.map(([x, y], index) => (
        <g key={index}>
          <rect
            x={(x - minX) * 24 + 1}
            y={(y - minY) * 24 + 1}
            width="21"
            height="21"
            rx="1"
            fill={color}
            fillOpacity="1"
            stroke={color}
            strokeWidth="5"
            strokeOpacity=".12"
          />
          <rect
            x={(x - minX) * 24 + 1}
            y={(y - minY) * 24 + 1}
            width="21"
            height="21"
            rx="1"
            fill="none"
            stroke={color}
            strokeWidth="1.4"
          />
          <rect
            x={(x - minX) * 24 + 2.5}
            y={(y - minY) * 24 + 2.5}
            width="18"
            height="18"
            rx=".5"
            fill="none"
            stroke="#fff"
            strokeWidth=".5"
            strokeOpacity=".5"
          />
        </g>
      ))}
    </svg>
  );
}
