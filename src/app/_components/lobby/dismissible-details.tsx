"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** 네이티브 details의 키보드 동작을 유지하면서 헤더 팝업에 바깥 클릭·터치·Escape 닫기를 공통 적용한다. */
export function DismissibleDetails({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;

    // 캡처 단계에서 확인하여 바깥 요소가 이벤트 전파를 막아도 닫고, 팝업 내부의 버튼·입력은 그대로 사용한다.
    function dismissOnOutsidePointer(event: PointerEvent) {
      if (details?.open && !event.composedPath().includes(details)) details.open = false;
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (details?.open && event.key === "Escape") {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    }

    // 열림 상태만 빠르게 확인하며 지연되는 toggle 이벤트와 무관하게 연속 클릭·Escape도 즉시 처리한다.
    document.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  // 같은 이름의 헤더 팝업은 키보드로 열더라도 한 번에 하나만 열리도록 브라우저가 관리한다.
  return (
    <details ref={detailsRef} className={className} name="lobby-header-popup">
      {children}
    </details>
  );
}
