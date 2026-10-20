import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./_components/brand";
import styles from "./auth.module.css";

/** 계정 페이지 이동에서는 배경과 카드 틀을 유지해 중복 이미지 로드와 레이아웃 변화를 줄인다. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.screen}>
      <div className={styles.backdrop} aria-hidden="true">
        <Image src="/images/auth/playground-world-hq.webp" alt="" fill sizes="(max-aspect-ratio: 16/9) 177.78vh, 100vw" quality={95} preload className={styles.worldImage} />
      </div>
      <a className={styles.skipLink} href="#auth-title">입력 폼으로 바로가기</a>
      <header className={styles.header}>
        <Link href="/" className={styles.homeLink} aria-label="Playground 홈"><Brand gradientId="header-gamepad" /></Link>
      </header>
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="auth-title">{children}</section>
      </main>
    </div>
  );
}
