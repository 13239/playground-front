"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createUuidV4 } from "@/lib/client/uuid";
import { registerGamePopup, supportsGamePopup } from "./game-popup";

type PopupScreen = Screen & { availLeft?: number; availTop?: number };

/** 작업 표시줄을 제외한 현재 모니터의 중앙을 계산하며 왼쪽·위쪽 보조 모니터의 음수 좌표도 유지한다. */
function centeredPopupPosition(display: PopupScreen, width: number, height: number) {
  return {
    left: Math.round((display.availLeft ?? 0) + Math.max(0, (display.availWidth - width) / 2)),
    top: Math.round((display.availTop ?? 0) + Math.max(0, (display.availHeight - height) / 2)),
  };
}

function subscribeToInputChange(onChange: () => void): () => void {
  const pointer = window.matchMedia("(pointer: coarse)");
  pointer.addEventListener("change", onChange);
  return () => pointer.removeEventListener("change", onChange);
}

/** 원본의 CSS·폰트와 nonce를 복사한다. 스크립트나 인증 정보를 별도 문서에 다시 생성하지 않는다. */
function shareStyles(target: Document): () => void {
  let copies: Element[] = [];
  let active = true;
  const controller = new AbortController();
  const fonts = new Map<string, Promise<FontFace>>();
  const cssText = (rule: CSSRule, base: string) => {
    if (rule.type === CSSRule.FONT_FACE_RULE) {
      const face = rule as CSSFontFaceRule;
      const path = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i.exec(face.style.getPropertyValue("src"));
      if (path) {
        const url = new URL(path[1] ?? path[2] ?? path[3], base);
        if (url.origin === location.origin) {
          // 로컬 폰트는 원본 창에서 한 번 읽고 버퍼를 공유해 빈 팝업 문서의 네트워크 로딩에 의존하지 않는다.
          const family = face.style.getPropertyValue("font-family").replace(/^['"]|['"]$/g, "");
          const key = `${family}:${face.cssText}`;
          if (!fonts.has(key)) {
            const loading = fetch(url, { signal: controller.signal, credentials: "same-origin" })
              .then(response => { if (!response.ok) throw new Error("Font unavailable"); return response.arrayBuffer(); })
              .then(buffer => new FontFace(family, buffer, {
                weight: face.style.getPropertyValue("font-weight") || "normal",
                style: face.style.getPropertyValue("font-style") || "normal",
                stretch: face.style.getPropertyValue("font-stretch") || "normal",
                unicodeRange: face.style.getPropertyValue("unicode-range") || "U+0-10FFFF",
                display: "swap",
              }).load());
            fonts.set(key, loading);
            void loading.then(font => { if (active) target.fonts.add(font); }).catch(() => { /* 폰트 로딩 실패 시 기존 시스템 대체 글꼴로 플레이를 유지한다. */ });
          }
          return "";
        }
      }
    }
    return rule.cssText;
  };
  const sync = () => {
    const next = Array.from(document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'), source => {
      // about:blank에서는 링크의 로드 수명에 의존하지 않고 이미 검증·로드된 같은 출처 CSS를 즉시 공유한다.
      // 상대 폰트·이미지 URL은 원본 스타일시트 기준으로 고정하고 원본 문서의 CSP nonce를 유지한다.
      if (source.sheet) {
        try {
          const copy = target.createElement("style");
          copy.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || source.nonce;
          copy.media = source.media;
          const base = source.sheet.href ?? document.baseURI;
          copy.textContent = Array.from(source.sheet.cssRules, rule => cssText(rule, base)).join("\n")
            .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (match, doubleQuoted, singleQuoted, unquoted) => {
              try { return `url(${JSON.stringify(new URL((doubleQuoted ?? singleQuoted ?? unquoted).trim(), base).href)})`; }
              catch { return match; }
            });
          return copy;
        } catch { /* CSSOM을 읽을 수 없는 외부 스타일시트는 아래의 원래 링크 속성을 유지한다. */ }
      }
      // 새 문서에서 노드를 만들어 원본 link의 로드 상태를 가져오지 않고 팝업에서도 CSS를 정상 로드한다.
      const copy = target.createElement(source.tagName.toLowerCase()) as HTMLLinkElement | HTMLStyleElement;
      for (const attribute of source.attributes) copy.setAttribute(attribute.name, attribute.value);
      copy.textContent = source.textContent;
      if (source.nonce) copy.nonce = source.nonce;
      if (source instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = source.href;
      return copy;
    });
    target.head.append(...next);
    copies.forEach(copy => copy.remove());
    copies = next;
  };
  sync();
  // 지연 로드된 스타일과 개발 중 스타일 변경도 같은 팝업 문서에 반영한다.
  const observer = new MutationObserver(sync);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "media", "disabled"] });
  // 게임을 지연 로드할 때 아직 로딩 중이던 스타일시트도 완료 직후 반영한다.
  document.head.addEventListener("load", sync, true);
  return () => {
    active = false;
    controller.abort();
    fonts.clear();
    observer.disconnect();
    document.head.removeEventListener("load", sync, true);
  };
}

/** React 상태·서버 연결은 원본에 유지하고 같은 게임 UI를 한 개의 일반 팝업에만 표시한다. */
export function useGamePopup(bodyClassName: string, title = "게임 · Playground", { width: preferredWidth = 520, height: preferredHeight = 720 }: { width?: number; height?: number } = {}) {
  const supported = useSyncExternalStore(subscribeToInputChange, supportsGamePopup, () => false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [error, setError] = useState("");
  const activeWindow = useRef<Window | null>(null);
  // 문서마다 추측할 수 없는 창 이름을 사용해 다른 탭의 팝업을 선택하거나 덮어쓰지 않는다.
  const activeName = useRef<string | null>(null);
  // 팝업에서 원본 창도 이름으로 다시 선택해 최소화된 브라우저를 복원한다.
  const sourceName = useRef<string | null>(null);
  const mounted = useRef(false);
  const disposeWindow = useRef<(() => void) | null>(null);

  // 표시 이름만 바뀌면 열린 팝업의 제목만 갱신하고 판·창 수명은 그대로 유지한다.
  useEffect(() => { const target = activeWindow.current; if (target && !target.closed) target.document.title = title; }, [title]);

  useEffect(() => {
    mounted.current = true;
    // 일반 팝업은 원본 탭 종료 시 자동으로 닫히지 않으므로 문서 종료도 함께 정리한다.
    const closeWindow = () => {
      disposeWindow.current?.();
    };
    window.addEventListener("pagehide", closeWindow);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", closeWindow);
      disposeWindow.current?.();
      activeWindow.current = null;
      activeName.current = null;
      sourceName.current = null;
    };
  }, []);

  const close = useCallback(() => {
    // 복귀 버튼은 원래 탭을 활성화하고, OS의 닫기 동작은 pagehide에서 화면만 복원한다.
    const popupWindow = activeWindow.current;
    if (popupWindow && !popupWindow.closed && sourceName.current) {
      try {
        // 사용자 클릭 안에서 팝업의 open을 호출한다. focus만으로 복원되지 않는 최소화 창도 다시 선택한다.
        // 빈 URL은 원본을 새로고침하지 않으며, 같은 Window인지 확인해 중복 빈 창을 남기지 않는다.
        const original = popupWindow.open("", sourceName.current);
        if (original !== window) original?.close();
      } catch { /* 창 재선택이 제한되면 아래의 기본 포커스 요청으로 복귀한다. */ }
    }
    window.focus();
    disposeWindow.current?.();
  }, []);

  const focus = useCallback(() => {
    const popupWindow = activeWindow.current;
    const name = activeName.current;
    if (!popupWindow || !name) return;
    if (popupWindow.closed) { disposeWindow.current?.(); return; }
    try {
      // opener를 해제한 창은 Chrome에서 focus()만으로 복원되지 않는다. 클릭 안에서 기존 이름을 다시 선택한다.
      // 빈 URL은 열린 문서를 탐색하지 않으므로 판·연결·사용자가 조정한 창 위치와 크기를 유지한다.
      const existing = window.open("", name);
      if (existing !== popupWindow) {
        // 닫기와 클릭이 겹쳐 새 빈 창이 만들어져도 대국 팝업으로 바꾸거나 중복 창으로 남기지 않는다.
        existing?.close();
        if (popupWindow.closed) disposeWindow.current?.();
        else popupWindow.focus();
        if (mounted.current) setError("팝업 창을 표시하지 못했어요. 브라우저의 팝업 허용 설정을 확인해 주세요.");
        return;
      }
      existing.focus();
      // 기존 이름을 다시 선택한 뒤에도 자식 문서에서 원본 탭에 접근할 권한을 남기지 않는다.
      existing.opener = null;
      if (mounted.current) setError("");
    } catch {
      if (mounted.current) setError("팝업 창을 표시하지 못했어요. 브라우저의 팝업 허용 설정을 확인해 주세요.");
    }
  }, []);

  const open = useCallback(() => {
    if (activeWindow.current && !activeWindow.current.closed) { focus(); return; }
    if (!supportsGamePopup()) return;
    disposeWindow.current?.();
    setError("");
    let popupWindow: Window | null = null;
    let stopSharing: (() => void) | undefined;
    let restoreSourceName: (() => void) | undefined;
    try {
      // 사용자 클릭 직후 호출해야 하므로 이 호출 앞에서 비동기 작업을 기다리지 않는다.
      // 기본 OS 창 장식을 유지해 사용자가 제목 표시줄의 최소화·최대화 버튼을 사용할 수 있다.
      const display = window.screen as PopupScreen;
      // 오목의 기본 크기는 유지하고 세로가 긴 테트리스는 게임에 맞는 최초 크기만 지정한다.
      const width = Math.min(preferredWidth, display.availWidth);
      const height = Math.min(preferredHeight, display.availHeight);
      const position = centeredPopupPosition(display, width, height);
      // 재표시에는 이 팝업만 다시 선택하며, 새 팝업을 열 때마다 이름을 새로 발급한다.
      const name = `playground-game-${createUuidV4()}`;
      popupWindow = window.open("about:blank", name, `popup,width=${width},height=${height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`);
      if (!popupWindow) {
        setError("팝업이 차단됐어요. 주소창에서 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.");
        return;
      }
      // 팝업이 열린 동안만 원본에 고유 이름을 부여하고, 종료 시 기존 이름을 되돌린다.
      const previousName = window.name;
      const originalName = `${name}-source`;
      window.name = originalName;
      sourceName.current = originalName;
      restoreSourceName = () => {
        if (window.name === originalName) window.name = previousName;
      };
      // 최초 생성 때만 실제 제목 표시줄·테두리까지 포함해 중앙을 보정한다. 이후 사용자의 이동은 유지한다.
      try {
        const outerWidth = Math.min(popupWindow.outerWidth || width, display.availWidth);
        const outerHeight = Math.min(popupWindow.outerHeight || height, display.availHeight);
        if (popupWindow.outerWidth > outerWidth || popupWindow.outerHeight > outerHeight) popupWindow.resizeTo(outerWidth, outerHeight);
        const centered = centeredPopupPosition(display, outerWidth, outerHeight);
        popupWindow.moveTo(centered.left, centered.top);
      } catch { /* 위치·크기 제어가 제한된 브라우저에서도 열린 대국 화면은 유지한다. */ }
      // React는 원본의 Window 참조를 사용하므로 자식의 opener 권한은 제공할 필요가 없다.
      popupWindow.opener = null;
      const target = popupWindow.document;
      target.documentElement.lang = document.documentElement.lang || "ko";
      target.documentElement.className = document.documentElement.className;
      target.body.className = bodyClassName;
      target.title = title;
      stopSharing = shareStyles(target);
      const root = target.createElement("div");
      target.body.append(root);
      const openedWindow = popupWindow;
      let disposed = false;
      let unregister = () => {};
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        stopSharing?.();
        restoreSourceName?.();
        openedWindow.removeEventListener("pagehide", dispose);
        // 팝업의 닫기·새로고침·다른 주소 이동은 원래 판으로 복귀하고 별도 참가를 만들지 않는다.
        unregister();
        if (!openedWindow.closed) openedWindow.close();
        if (activeWindow.current === openedWindow) {
          activeWindow.current = null;
          activeName.current = null;
          sourceName.current = null;
          disposeWindow.current = null;
          if (mounted.current) setContainer(null);
        }
      };
      activeWindow.current = popupWindow;
      activeName.current = name;
      disposeWindow.current = dispose;
      popupWindow.addEventListener("pagehide", dispose, { once: true });
      unregister = registerGamePopup(popupWindow);
      setContainer(root);
    } catch {
      // 거부·브라우저 오류가 발생해도 원래 대국 화면과 접속은 그대로 유지한다.
      stopSharing?.();
      restoreSourceName?.();
      sourceName.current = null;
      popupWindow?.close();
      disposeWindow.current?.();
      if (mounted.current) setError("팝업 창을 열지 못했어요. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.");
    }
  }, [bodyClassName, focus, title, preferredWidth, preferredHeight]);

  return { supported, container, error, open, close, focus };
}
