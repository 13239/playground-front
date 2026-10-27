"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useState, type RefObject } from "react";

/** 공통 컨트롤도 FormData·reset·기존 상위 폼의 변경 감지에 참여하도록 네이티브 이벤트를 사용한다. */
export function changeNativeValue(control: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!control || control.matches(":disabled")) return;
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

/** 제어/비제어 입력을 함께 지원하고 폼 reset은 저장할 변경 이벤트를 새로 발생시키지 않는다. */
export function useFormControlValue(ref: RefObject<HTMLInputElement | HTMLSelectElement | null>, value: string | undefined, initial: string, change?: (value: string) => void) {
  const [local, setLocal] = useState(initial);
  const current = value ?? local;
  useLayoutEffect(() => {
    // 제어 select의 브라우저 기본 reset도 최신 제어 값으로 맞춰 reset 직후 제출해도 표시 값과 FormData가 일치한다.
    if (value === undefined || !(ref.current instanceof HTMLSelectElement)) return;
    for (const option of ref.current.options) option.toggleAttribute("selected", option.value === value);
  }, [ref, value]);
  const reset = useEffectEvent(() => {
    if (value === undefined) setLocal(initial);
    if (ref.current) ref.current.value = value ?? initial;
  });
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    // reset 이벤트의 기본 동작이 select를 초기화한 뒤 제어 값까지 복원한다. microtask는 기본 동작보다 먼저 실행될 수 있다.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handle = (event: Event) => { clearTimeout(timer); timer = setTimeout(() => { if (!event.defaultPrevented) reset(); }, 0); };
    form.addEventListener("reset", handle);
    return () => { clearTimeout(timer); form.removeEventListener("reset", handle); };
  }, [ref]);
  return { value: current, change: (next: string) => { if (value === undefined) setLocal(next); change?.(next); } };
}
