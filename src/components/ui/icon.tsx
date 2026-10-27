import type { ReactNode } from "react";

/** 로비 아이콘은 벡터로 표시하여 고해상도 화면에서도 선명하게 유지하고 외부 폰트 요청을 줄인다. */
const paths = {
  // 관리자 지표·서비스 상태도 기존 벡터 좌표계와 선 굵기로 표시한다.
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z" /></>,
  chart: <><path d="M5 21V11M12 21V3M19 21V7" /></>,
  userPlus: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M20 6v8M16 10h8" /></>,
  shield: <path d="m12 3 8 3v6c0 5-5 8-8 10-3-2-8-5-8-10V6Z" />,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 8a2.5 2.5 0 1 1 4.2 1.8c-1.2.8-1.7 1.2-1.7 3M12 17h.01" /></>,
  // 닉네임 편집도 별도 이미지 요청 없이 공통 벡터 아이콘으로 표시한다.
  edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6 5-2" /></>,
  // 오목의 작은 창 전환도 공통 벡터 아이콘과 같은 선 굵기를 사용한다.
  popup: <><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="12" y="11" width="7" height="6" rx="1" /></>,
  expand: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></>,
  // 오목 방 화면도 같은 벡터 아이콘 체계를 공유한다.
  plus: <path d="M12 4v16M4 12h16" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 7h14M5 17h14" /></>,
  undo: <><path d="m8 4-5 5 5 5M3 9h10a6 6 0 1 1 0 12h-3" /></>,
  scale: <><path d="M12 3v18M7 21h10M4 6h16M6 6l-4 9h8L6 6Zm12 0-4 9h8l-4-9Z" /></>,
  gear: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 3h3l1-3 3-1 2-3-2-2 1-3-2-3-3 1-2-3Z" /><circle cx="11.5" cy="11.5" r="3" /></>,
  link: <><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" /></>,
  lightning: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  // AI 대전은 공통 SVG의 선 굵기와 좌표계를 공유하는 로봇 아이콘으로 표시한다.
  robot: (
    <>
      <rect x="4" y="7" width="16" height="14" rx="3" />
      <path d="M12 3v4M2 12v4m20-4v4M9 17h6" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
    </>
  ),
  book: <><path d="M12 5C9 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-7-2-10 1Zm0 0v15" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  eye: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  flame: (
    <path d="M13 2c2 6-3 6-1 10 1-2 3-3 4-5 2 3 4 5 4 8a8 8 0 0 1-16 0c0-4 3-7 5-9-1 5 1 5 2 6-1-4 3-6 2-10Z" />
  ),
  new: (
    <>
      <path d="m12 2 3 2 3.5.5.5 3.5 2 4-2 3-.5 3.5-3.5.5-3 3-3-3-3.5-.5L5 15l-2-3 2-4 .5-3.5L9 4Z" />
      <path d="M8 14v-4l3 4v-4m3 0h3m-3 2h2m-2 2h3" />
    </>
  ),
  "2d": (
    <>
      <rect x="2" y="5" width="20" height="14" rx="7" />
      <path d="M6.5 10a2 2 0 0 1 4 0c0 2-4 2-4 4h4m3-6v6h1a3 3 0 0 0 0-6Z" />
    </>
  ),
  cube: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10v10M3 7l9 5 9-5M7.5 4.5l9 5v5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3Zm15-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5v2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
    </>
  ),
  puzzle: (
    <path d="M9 3h6v4a3 3 0 1 1 4 4h2v10h-7v-3a3 3 0 1 0-4 0v3H3v-7h3a3 3 0 1 0 0-4H3V3h6Z" />
  ),
  car: (
    <>
      <path d="m5 8 2-5h10l2 5m-14 0h14l2 4v7H3v-7Zm0 11v2m14-2v2M3 14h18" />
      <circle cx="7" cy="11" r="1" />
      <circle cx="17" cy="11" r="1" />
    </>
  ),
  swords: (
    <>
      <path d="m3 3 5 1 10 11-3 3L4 8Zm0 18 5-5m6-9 4-3 3-1-1 5-3 4m-4 7 6-6m-2 4 4 4m-16-8 6 6" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18m6-18v18M3 9h18M3 15h18" />
      <circle cx="9" cy="9" r="2.5" fill="currentColor" />
      <circle cx="15" cy="15" r="2.5" fill="currentColor" />
    </>
  ),
  city: (
    <>
      <path d="M2 21h20M4 21V9h5v12m0 0V3h7v18m0 0V7h4v14M12 7h1m-1 4h1m-1 4h1M6 12v2m12-4v2" />
    </>
  ),
  gamepad: (
    <>
      <path d="M8 6h8c4 0 5 3 6 10 .6 4-2 5-4 2l-2-3H8l-2 3c-2 3-4.6 2-4-2C3 9 4 6 8 6Z" />
      <path d="M7 9v5m-2.5-2.5h5M15.5 10h.01M18.5 13h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1" />
    </>
  ),
  // 달력도 다른 공통 아이콘과 같은 좌표계·선 굵기를 사용한다.
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-12 4h.01M12 15h.01M16 15h.01" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  arrow: <path d="M4 12h16m-7-7 7 7-7 7" />,
  chat: (
    <path d="M21 11.5a9 9 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.7-5a8 8 0 0 1-1.7-4.5A9 9 0 0 1 12 3a9 9 0 0 1 9 8.5ZM8 11h.01M12 11h.01M16 11h.01" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01" />
    </>
  ),
  send: (
    <>
      <path d="m3 3 19 9-19 9 3-9Zm3 9h16" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  // 대기실 나가기도 기존 벡터 아이콘과 같은 선 굵기·좌표계를 사용한다.
  exit: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>,
  // 대국 기권은 시안의 깃발을 같은 SVG 아이콘 체계로 제공한다.
  flag: <><path d="M5 22V3m0 1c5-4 9 4 14 0v11c-5 4-9-4-14 0" /></>,
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export function Icon({
  name,
  className,
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
