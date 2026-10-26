"use client";

import Link from "next/link";
import { useEffect, useRef, type ComponentProps } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./admin.module.css";

export type AdminNavigationItem = Readonly<{
  key: string;
  name: string;
  menuName?: string;
  icon: ComponentProps<typeof LobbyIcon>["name"];
}>;

/** 상위에서 권한을 확인한 메뉴만 표시하고 선택한 메뉴를 본문과 이어지는 탭으로 표현한다. */
export function AdminNavigation({ items, selected }: { items: readonly AdminNavigationItem[]; selected?: string }) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const revealSelected = () => {
      const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current || nav.scrollWidth <= nav.clientWidth) return;
      // 늘어난 메뉴도 모바일 가로 탐색에서 현재 위치가 보이도록 이동한다. 본문 스크롤은 바꾸지 않는다.
      const offset = current.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      nav.scrollTo({ left: nav.scrollLeft + offset - (nav.clientWidth - current.offsetWidth) / 2, behavior: "instant" });
    };
    revealSelected();
    // 화면 회전·창 크기 변경으로 세로 메뉴가 가로 탭으로 바뀌어도 현재 메뉴를 다시 보여 준다.
    const observer = new ResizeObserver(revealSelected);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [selected, items.length]);
  return <aside className={styles.sidebar}>
    <div className={styles.consoleLabel}><LobbyIcon name="gear" /><span>관리자 페이지</span></div>
    <nav ref={navRef} aria-label="관리자 메뉴">{items.map(item => <Link key={item.key} href={`/admin/${item.key}`} prefetch={false}
      aria-current={selected === item.key ? "page" : undefined}><LobbyIcon name={item.icon} />{item.menuName ?? item.name}</Link>)}</nav>
  </aside>;
}
