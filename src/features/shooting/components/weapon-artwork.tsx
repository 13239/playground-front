import type { WeaponId } from "@playground/shooting-shared";

/** 별도 이미지 다운로드 없이 같은 금속색·비율로 네 가지 시작 무기를 구분한다. */
export function WeaponArtwork({ weapon }: { weapon: WeaponId }) {
  const long = weapon === "sniper",
    launcher = weapon === "launcher",
    shotgun = weapon === "shotgun";
  return (
    <svg viewBox="0 0 240 90" aria-hidden="true" focusable="false">
      <path
        d="m12 38 43 2 18 13-23 14-34-1Z"
        fill="#48586a"
        stroke="#9bacc1"
        strokeWidth="2"
      />
      <path
        d="m68 40 25 6-8 28-13-2 4-20Z"
        fill="#293847"
        stroke="#8a9db1"
        strokeWidth="2"
      />
      <path
        d="m58 30 84 0 18 8-9 16H62Z"
        fill="#7b8d9e"
        stroke="#c1ced8"
        strokeWidth="2"
      />
      <path d="M70 34h63M72 40h56M92 47h27" stroke="#263647" strokeWidth="3" />
      {launcher ? (
        <>
          <rect
            x="142"
            y="27"
            width="65"
            height="28"
            rx="10"
            fill="#526577"
            stroke="#aab9c6"
            strokeWidth="2"
          />
          <path
            d="M155 28v26m13-26v26m13-26v26m13-26v26"
            stroke="#263647"
            strokeWidth="3"
          />
        </>
      ) : (
        <>
          <rect
            x="146"
            y="34"
            width={long ? 75 : 60}
            height={shotgun ? 12 : 7}
            rx="2"
            fill="#8fa2b3"
            stroke="#c1ced8"
          />
          <path d="m147 47 41 0" stroke="#3a4858" strokeWidth="8" />
        </>
      )}
      {!shotgun && !launcher && (
        <path
          d="m112 54 22 0-4 25-14-2Z"
          fill="#516579"
          stroke="#9bacc1"
          strokeWidth="2"
        />
      )}
      {long && (
        <>
          <rect
            x="91"
            y="14"
            width="42"
            height="10"
            rx="3"
            fill="#647f94"
            stroke="#bdcedb"
          />
          <path d="M100 24v6m23-6v6" stroke="#b2c2d0" strokeWidth="3" />
        </>
      )}
      <path d="M24 72h185" stroke="#060c15" strokeWidth="5" opacity=".35" />
    </svg>
  );
}
