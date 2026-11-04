import type { WeaponId } from "@playground/shooting-shared";

/** 별도 이미지 다운로드 없이 총열·개머리판·탄창·조준경의 실루엣과 재질색으로 네 가지 시작 무기를 구분한다. */
// 프로필 캐릭터의 보라색 외곽·파스텔 재질과 맞추되 무기별 실루엣은 유지한다.
export function WeaponArtwork({ weapon }: { weapon: WeaponId }) {
  return (
    <svg viewBox="0 0 240 90" aria-hidden="true" focusable="false">
      <path d="M16 79h210" stroke="#060c15" strokeWidth="5" opacity=".3" />
      {weapon === "rifle" && (
        <g stroke="#b7c9d6" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M16 32h35l20 10-16 16H17l-5-8Z" fill="#b29bde" />
          <path d="M27 38h21l10 6-10 7H27Z" fill="#51306c" stroke="none" />
          <path d="M64 31h78l20 10-12 15H64Z" fill="#d5c6f1" />
          <path d="M79 55h17l-9 24H73l6-18Z" fill="#8f6ab8" />
          <path d="M115 54h20q-1 17-12 24h-18q12-11 10-24Z" fill="#e5c68c" />
          <path d="M145 34h43v20h-43Z" fill="#b39ad7" />
          <path d="M189 39h27v9h-27Z" fill="#dfe5ff" />
          <path d="M217 36h11v15h-11Z" fill="#76509d" />
          <path
            d="M77 37h55m-55 7h36m42-5v10m10-10v10m10-10v10"
            stroke="#8f70b5"
            strokeWidth="3"
          />
          <path d="M94 24h29v7H94Z" fill="#b08bd7" />
        </g>
      )}
      {weapon === "shotgun" && (
        <g stroke="#d0b899" strokeWidth="1.6" strokeLinejoin="round">
          <path d="m13 36 44 5 24 10-20 8-19 17H14l-4-12Z" fill="#b695d3" />
          <path d="m24 43 25 3 12 6-19 13H23Z" fill="#dac3f1" stroke="none" />
          <path d="M69 36h42l14 8-8 17H72Z" fill="#cdb9ea" />
          <path
            d="M108 31h112v10H108Zm0 15h112v10H108Z"
            fill="#d8c8f2"
            stroke="#c9d5dc"
          />
          <rect x="119" y="39" width="51" height="25" rx="6" fill="#b69ad5" />
          <path
            d="M128 43v17m10-17v17m10-17v17m10-17v17"
            stroke="#8760b2"
            strokeWidth="3"
          />
          <path d="M220 28h8v31h-8Z" fill="#79509e" stroke="#c9d5dc" />
          <path
            d="m78 59-8 10h21l7-10"
            fill="none"
            stroke="#8496a1"
            strokeWidth="3"
          />
        </g>
      )}
      {weapon === "sniper" && (
        <g stroke="#b7c8be" strokeWidth="1.5" strokeLinejoin="round">
          <path d="m10 43 43-8 23 10-8 16-29 6-10 9H13Z" fill="#ac9bcf" />
          <path d="m23 49 28-6 9 5-13 9H24Z" fill="#775799" stroke="none" />
          <path d="M70 38h67l12 6-11 12H68Z" fill="#cebee8" />
          <path d="M141 41h73v6h-73Z" fill="#bcdde9" />
          <path d="M215 37h17v14h-17Z" fill="#704c95" />
          <path d="m88 55 14 1-7 20H82Z" fill="#9671b7" />
          <rect
            x="88"
            y="17"
            width="61"
            height="15"
            rx="5"
            fill="#ad8bcf"
            stroke="#a4d5dc"
          />
          <path
            d="M83 14h12v21H83Zm56-2h17v25h-17Z"
            fill="#be9fe5"
            stroke="#b4e0ea"
          />
          <path
            d="M104 32v6m27-6v6m43 10-11 24m11-24 15 24"
            stroke="#b0c5c6"
            strokeWidth="3"
          />
          <path d="M155 43h41" stroke="#8866a7" strokeWidth="2" />
        </g>
      )}
      {weapon === "launcher" && (
        <g stroke="#d1c6a7" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M15 33h34v29H15l-5-7V40Z" fill="#b99bd8" />
          <path d="M45 30h49v32H45Z" fill="#c9aee9" />
          <rect x="82" y="23" width="116" height="33" rx="13" fill="#d4bdf1" />
          <path
            d="M103 24v30m18-30v30m18-30v30m18-30v30m18-30v30"
            stroke="#8e62b4"
            strokeWidth="4"
          />
          <ellipse cx="201" cy="39.5" rx="15" ry="19" fill="#f0cd8e" />
          <ellipse
            cx="204"
            cy="39.5"
            rx="8"
            ry="12"
            fill="#735096"
            stroke="#e5d49e"
          />
          <circle cx="113" cy="62" r="17" fill="#ba94d8" />
          <circle cx="113" cy="62" r="9" fill="#e6be7a" />
          <path d="M106 62h14m-7-7v14M61 60l15 2-6 16H54Z" fill="#9871b9" />
          <path
            d="M69 27V15h59v8"
            fill="none"
            stroke="#b4c5cf"
            strokeWidth="6"
          />
        </g>
      )}
    </svg>
  );
}
