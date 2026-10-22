import { getImageProps } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import desktopArtwork from "../../../public/images/auth/playground-world-hq.webp";
import portraitArtwork from "../../../public/images/auth/playground-world-mobile.webp";
import { Brand } from "./_components/brand";
import styles from "./auth.module.css";

/** 계정 페이지 이동에서는 배경과 카드 틀을 유지해 중복 이미지 로드와 레이아웃 변화를 줄인다. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  // picture가 화면에 맞는 구도 하나만 요청하고, 정적 이미지의 콘텐츠 해시로 교체된 배경을 캐시에 반영한다.
  const common = {
    alt: "",
    fill: true,
    quality: 95,
    loading: "eager" as const,
    fetchPriority: "high" as const,
    className: styles.worldImage,
  };
  const { props: desktopImage } = getImageProps({
    ...common,
    src: desktopArtwork,
    sizes: "(max-aspect-ratio: 16/9) 177.78vh, 100vw",
  });
  const { props: portraitImage } = getImageProps({
    ...common,
    src: portraitArtwork,
    sizes: "(max-width: 480px) 640px, 100vw",
  });

  return (
    <div className={styles.screen}>
      <div className={styles.backdrop} aria-hidden="true">
        <picture>
          <source
            media="(width < 48rem), (max-aspect-ratio: 3/4)"
            srcSet={portraitImage.srcSet}
            sizes={portraitImage.sizes}
          />
          {/* 문구가 없는 장식용 배경은 보조 기술이 중복해서 읽지 않도록 대체 텍스트를 비운다. */}
          <img {...desktopImage} alt="" />
        </picture>
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
