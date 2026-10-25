/** 로비 표지도 테트리스의 LIGHTLINE 블록을 사용한다. 외부 이미지·게임 엔진은 로딩하지 않는다. */
export function TetrisCover() {
  const blocks = [
    [0, 6, 0],
    [0, 7, 0],
    [1, 7, 0],
    [2, 7, 0],
    [2, 6, 1],
    [3, 6, 1],
    [3, 7, 1],
    [4, 7, 1],
    [4, 6, 2],
    [4, 5, 2],
    [5, 6, 2],
    [5, 7, 2],
    [6, 7, 3],
    [7, 7, 3],
    [6, 6, 3],
    [7, 6, 3],
    [8, 5, 4],
    [8, 6, 4],
    [8, 7, 4],
    [9, 7, 4],
    [4, 1, 5],
    [4, 2, 5],
    [4, 3, 5],
    [4, 4, 5],
  ];
  const colors = [
    "#77aaff",
    "#72efb7",
    "#c68cff",
    "#ffcf70",
    "#ff849b",
    "#6ae7ff",
  ];
  return (
    <svg
      viewBox="0 0 440 250"
      role="img"
      aria-label="빛나는 블록이 쌓인 테트리스 게임판"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="440" height="250" fill="#0c1423" />
      <path d="M90 0v250M350 0v250" stroke="#495077" />
      {Array.from({ length: 11 }, (_, i) => (
        <path
          key={`x${i}`}
          d={`M${90 + i * 26} 0v250`}
          stroke="#28354c"
          strokeOpacity=".6"
        />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <path
          key={`y${i}`}
          d={`M90 ${i * 26 + 17}h260`}
          stroke="#28354c"
          strokeOpacity=".6"
        />
      ))}
      {blocks.map(([x, y, color], i) => (
        <g key={i}>
          <rect
            x={92 + x * 26}
            y={19 + y * 26}
            width="22"
            height="22"
            rx="1"
            stroke={colors[color]}
            strokeWidth="6"
            strokeOpacity=".13"
          />
          <rect
            x={92 + x * 26}
            y={19 + y * 26}
            width="22"
            height="22"
            rx="1"
            fill={colors[color]}
            fillOpacity=".05"
            stroke={colors[color]}
            strokeWidth="1.5"
          />
        </g>
      ))}
    </svg>
  );
}
