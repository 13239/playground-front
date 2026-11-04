"use client";
import { useEffect, type RefObject } from "react";

/** 실제 헤더·제목 높이를 뺀 가용 영역을 사용한다. 글꼴 확대·창 높이 변경에도 주요 조작이 화면에 남는다. */
export function useArenaViewport(arena: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const resize = () => {
      const element = arena.current;
      if (!element) return;
      // 푸터와 본문 하단 여백도 실제 크기로 제외해 FHD에서 주요 조작 아래에 불필요한 스크롤이 생기지 않게 한다.
      const main = element.closest("main");
      const footer = main?.parentElement?.querySelector("footer");
      const bottom = main
        ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 18;
      const frame = getComputedStyle(element);
      const borders =
        (Number.parseFloat(frame.borderTopWidth) || 0) +
        (Number.parseFloat(frame.borderBottomWidth) || 0);
      const available =
        window.innerHeight - element.getBoundingClientRect().top -
        (footer?.getBoundingClientRect().height ?? 0) - bottom - borders;
      element.style.setProperty(
        "--arena-available-height",
        `${Math.max(300, Math.floor(available))}px`,
      );
    };
    const observer = new ResizeObserver(resize);
    if (arena.current?.parentElement) observer.observe(arena.current.parentElement);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [arena]);
}
