import styles from "../login.module.css";

/** Inline SVG stays sharp at every size and needs no icon/font dependency. */
export function Brand({ gradientId }: { gradientId: string }) {
  return (
    <span className={styles.brand}>
      <svg
        className={styles.brandMark}
        viewBox="0 0 64 52"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="13"
            y1="4"
            x2="43"
            y2="48"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#a41aff" />
            <stop offset="0.48" stopColor="#3300ff" />
            <stop offset="1" stopColor="#00cfff" />
          </linearGradient>
        </defs>
        <path
          d="M19 7C12 7 9 11 7 18L2.5 37.5C.5 47 8.5 51.5 14 45.5L22 36H42L50 45.5C55.5 51.5 63.5 47 61.5 37.5L57 18C55 11 52 7 45 7C40 7 38 10 32 10S24 7 19 7Z"
          fill={`url(#${gradientId})`}
          stroke="white"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d="M19 17V28M13.5 22.5H24.5"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g fill="white">
          <circle cx="46" cy="17.5" r="2.4" />
          <circle cx="40.5" cy="23" r="2.4" />
          <circle cx="51.5" cy="23" r="2.4" />
          <circle cx="46" cy="28.5" r="2.4" />
        </g>
      </svg>
      <svg
        className={styles.wordmark}
        viewBox="0 0 210 52"
        role="img"
        aria-label="Playground"
        focusable="false"
      >
        <text
          x="8"
          y="39"
          fontSize="40"
          textLength="203"
          lengthAdjust="spacingAndGlyphs"
          transform="skewX(-9)"
          fill="currentColor"
        >
          Playground
        </text>
      </svg>
    </span>
  );
}
