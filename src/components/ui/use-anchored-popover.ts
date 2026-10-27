"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";

/** 공통 선택·달력 팝업은 모달 위에서도 같은 레이어·여백·화면 경계 계산을 사용한다. */
export function useAnchoredPopover<A extends HTMLElement = HTMLButtonElement, P extends HTMLElement = HTMLUListElement>({ open, onClose, width, minWidth = 9, maxHeight = 24, belowContent = false, align = "start" }: {
  open: boolean; onClose: () => void;
  width?: number; minWidth?: number; maxHeight?: number; belowContent?: boolean; align?: "start" | "end";
}) {
  // 위치를 변경할 DOM ref는 훅이 소유해 호출자의 props나 렌더링 데이터를 변경하지 않는다.
  const root = useRef<HTMLDivElement>(null), anchor = useRef<A>(null), popup = useRef<P>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    // 바깥 클릭은 선택을 바꾸지 않고 목록만 닫으며 다음 컨트롤의 포커스를 가로채지 않는다.
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !popup.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open, root, popup]);

  useLayoutEffect(() => {
    const element = popup.current, trigger = anchor.current;
    // 같은 커밋에 부모 모달이 제거된 경우 분리된 요소에서 popover API를 호출하지 않는다.
    if (!open || !element?.isConnected || !trigger?.isConnected) return;
    // 모달·그리드의 스크롤 영역에 잘리지 않도록 네이티브 최상위 팝업을 사용한다.
    element.showPopover();
    const position = () => {
      if (!element.isConnected || !trigger.isConnected) return;
      const rect = (trigger.closest<HTMLElement>("[data-focus-frame]") ?? trigger).getBoundingClientRect(), viewport = window.visualViewport;
      const unit = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const viewWidth = viewport?.width ?? innerWidth, viewHeight = viewport?.height ?? innerHeight;
      const gutter = unit * .5, gap = unit * .375;
      const popupWidth = Math.min(width ? width * unit : Math.max(rect.width, minWidth * unit), Math.max(0, viewWidth - gutter * 2));
      element.style.width = `${popupWidth}px`;
      // 다중 선택은 라벨 아래 또는 검색창 위에 배치해 목록이 선택 해제 버튼을 가리지 않게 한다.
      const lowerEdge = belowContent ? root.current?.getBoundingClientRect().bottom ?? rect.bottom : rect.bottom;
      const below = Math.max(0, top + viewHeight - lowerEdge - gap - gutter), above = Math.max(0, rect.top - top - gap - gutter);
      const desiredHeight = Math.min(element.scrollHeight + 2, unit * maxHeight);
      const upward = below < desiredHeight && above > below;
      element.style.maxHeight = `${Math.min(unit * maxHeight, upward ? above : below)}px`;
      const height = element.getBoundingClientRect().height;
      const x = align === "end" ? rect.right - popupWidth : rect.left;
      element.style.left = `${Math.max(left + gutter, Math.min(x, left + viewWidth - popupWidth - gutter))}px`;
      element.style.top = `${Math.max(top + gutter, Math.min(upward ? rect.top - height - gap : lowerEdge + gap, top + viewHeight - height - gutter))}px`;
    };
    position();
    const observer = new ResizeObserver(position); observer.observe(trigger);
    if (belowContent && root.current) observer.observe(root.current);
    // 연·월 보기, 로딩 결과 등 팝업 내용 높이가 달라져도 같은 기준으로 다시 배치한다.
    const contentObserver = new MutationObserver(position); contentObserver.observe(element, { childList: true, subtree: true });
    window.addEventListener("resize", position); document.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position); window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect(); contentObserver.disconnect(); window.removeEventListener("resize", position); document.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position); window.visualViewport?.removeEventListener("scroll", position);
      if (element.isConnected && element.matches(":popover-open")) element.hidePopover();
    };
  }, [open, root, anchor, popup, width, minWidth, maxHeight, belowContent, align]);
  return { root, anchor, popup };
}
