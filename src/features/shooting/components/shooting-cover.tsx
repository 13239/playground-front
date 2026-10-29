import { useId } from "react";

/** 전장과 같은 금속 바닥·파란 플레이어·붉은 적을 고해상도 벡터 표지로 표시한다. */
export function ShootingCover() {
  const id = useId();
  return (
    <svg
      viewBox="0 0 600 340"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="슈팅 서바이벌의 기계 전장"
    >
      <defs>
        <pattern
          id={`${id}-floor`}
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <rect width="48" height="48" fill="#172331" />
          <path d="M0 0h48v48" fill="none" stroke="#304052" strokeWidth="2" />
          <circle cx="6" cy="6" r="1.5" fill="#637589" />
        </pattern>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#5ccaff" stopOpacity=".2" />
          <stop offset="1" stopColor="#0a101b" stopOpacity=".8" />
        </radialGradient>
      </defs>
      <rect width="600" height="340" fill={`url(#${id}-floor)`} />
      <rect width="600" height="340" fill={`url(#${id}-light)`} />
      <g fill="#354758" stroke="#69788b" strokeWidth="2">
        <rect x="70" y="65" width="105" height="55" rx="4" />
        <rect x="410" y="220" width="110" height="60" rx="4" />
      </g>
      <g fill="none" stroke="#b39158" strokeWidth="4" strokeDasharray="9 9">
        <path d="M79 110h86m255 160h90" />
      </g>
      <g transform="translate(272 187) rotate(-30)">
        <circle r="43" fill="#73caff" opacity=".06" />
        <circle r="30" fill="none" stroke="#7ed1ff" opacity=".35" />
        <ellipse cy="20" rx="32" ry="13" fill="#070c15" opacity=".6" />
        <rect x="-20" y="-25" width="40" height="48" rx="12" fill="#6bbcf1" />
        <rect x="-14" y="-17" width="28" height="15" rx="5" fill="#23445d" />
        <path d="M-9-10H9" stroke="#d3f4ff" strokeWidth="4" />
        <rect x="-27" y="-6" width="11" height="28" rx="4" fill="#8ca8ba" />
        <rect x="16" y="-6" width="11" height="28" rx="4" fill="#8ca8ba" />
        <rect x="8" y="-49" width="9" height="46" rx="2" fill="#0d1825" />
        <path d="M12-55v-12" stroke="#c2f4ff" strokeWidth="4" />
      </g>
      <g fill="#b55e66" stroke="#161d28" strokeWidth="4">
        <rect
          x="380"
          y="75"
          width="32"
          height="35"
          rx="6"
          transform="rotate(20 396 93)"
        />
        <rect
          x="467"
          y="123"
          width="32"
          height="35"
          rx="6"
          transform="rotate(40 483 140)"
        />
        <rect
          x="145"
          y="240"
          width="32"
          height="35"
          rx="6"
          transform="rotate(-40 161 257)"
        />
      </g>
      <g strokeLinecap="round">
        <path
          d="m322 141 33-21m-56 37 11-7m78 38 17 7"
          stroke="#b5ebff"
          strokeWidth="3"
        />
        <path d="m430 122-13 7m31 39-16 2" stroke="#ff8b8b" strokeWidth="4" />
      </g>
      <text
        x="26"
        y="304"
        fontFamily="system-ui,sans-serif"
        fontSize="14"
        fontWeight="700"
        letterSpacing="4"
        fill="#b0cbdf"
      >
        AIM. SURVIVE. GO FURTHER.
      </text>
    </svg>
  );
}
