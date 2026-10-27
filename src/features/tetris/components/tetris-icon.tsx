import type { CSSProperties } from "react";
import { gearIcon } from "@/components/ui/icon";

const paths = {
  crown: (
    <>
      <path d="m3 6 4 4 5-7 5 7 4-4-3 13H6L3 6Z" />
      <path d="M6 22h12" />
    </>
  ),
  chart: (
    <>
      <path d="M5 21V12m7 9V7m7 14V3" strokeWidth="4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v8a4 4 0 0 1-8 0V3Zm4 12v5m-4 1h8M8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5" />
    </>
  ),
  sound: (
    <>
      <path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 6 6m0-6-6 6" />
    </>
  ),
  /* 상대 좌표로 이은 이전 외곽선은 톱니가 찌그러졌다. 공통 톱니와 같은 두꺼운 외곽선·가운데 고리를 쓴다. */
  settings: gearIcon,
  expand: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />,
  // 사각 창과 바깥 화살표로 전체 화면 아이콘 옆의 팝업 동작을 구분한다.
  popup: <path d="M14 3h7v7m0-7L11 13M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  restart: <path d="M4 10a8 8 0 1 1 2 8M4 4v6h6" />,
  gamepad: (
    <>
      <path d="M7 6h10c4 0 6 12 3 13-2 1-4-3-5-3H9c-1 0-3 4-5 3C1 18 3 6 7 6Z" />
      <path d="M6 10v5m-2-2.5h4m8-2h.1m2 3h.1" />
    </>
  ),
};
/** 테트리스 전용 동작 아이콘은 같은 선 굵기와 크기를 사용한다. */
export function TetrisIcon({
  name,
  style,
}: {
  name: keyof typeof paths;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
