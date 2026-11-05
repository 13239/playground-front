"use client";
import { useEffect, type RefObject } from "react";

/** 실제 헤더·제목 높이를 뺀 가용 영역을 사용한다. 글꼴 확대·창 높이 변경에도 주요 조작이 화면에 남는다. */
export function useArenaViewport(arena: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let scheduledFrame: number | undefined;
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
      // 스크롤된 상태에서 창 크기를 바꿔도 문서 기준 위치를 사용해 전장 높이가 불필요하게 늘어나지 않게 한다.
      const documentTop = element.getBoundingClientRect().top + window.scrollY;
      const available =
        window.innerHeight - documentTop -
        (footer?.getBoundingClientRect().height ?? 0) - bottom - borders;
      const height = `${Math.max(300, Math.floor(available))}px`;
      if (element.style.getPropertyValue("--arena-available-height") !== height)
        element.style.setProperty("--arena-available-height", height);
    };
    // 카드가 프레임 높이를 채울 때도 관찰 중인 레이아웃을 즉시 다시 변경하지 않도록 다음 프레임에서 한 번만 계산한다.
    const scheduleResize = () => {
      if (scheduledFrame !== undefined) return;
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = undefined;
        resize();
      });
    };
    const observer = new ResizeObserver(scheduleResize);
    if (arena.current?.parentElement) observer.observe(arena.current.parentElement);
    window.addEventListener("resize", scheduleResize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      if (scheduledFrame !== undefined) cancelAnimationFrame(scheduledFrame);
    };
  }, [arena]);
}
