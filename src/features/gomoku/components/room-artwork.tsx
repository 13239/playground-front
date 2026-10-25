"use client";

import Image from "next/image";
import Link from "next/link";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./gomoku.module.css";
import { useGomokuCatalog } from "../client/use-gomoku-catalog";

/** 작은 표지와 배너가 같은 최적화 이미지를 사용하고 제목·설명은 이미지에 굽지 않는다. */
export function RoomArtwork({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.cover} ${className}`}>
      <Image
        src="/images/gomoku/board-blossoms.webp"
        alt=""
        fill
        sizes="(max-width: 640px) 80px, 140px"
      />
    </div>
  );
}
export function RoomHero({ create = false }: { create?: boolean }) {
  const { game, name, error } = useGomokuCatalog();
  return (
    <section
      className={`${styles.hero} ${create ? styles.createHero : ""}`}
      aria-labelledby="gomoku-title"
    >
      <Image
        className={styles.heroBackground}
        src="/images/gomoku/board-blossoms.webp"
        alt=""
        fill
        sizes="(min-width: 2560px) 2200px, 100vw"
        preload
      />
      {create && (
        <Image
          className={styles.heroCat}
          src="/images/gomoku/cat-mascot.webp"
          alt=""
          width={240}
          height={240}
        />
      )}
      <div className={styles.heroContent}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href="/">홈</Link>
          <LobbyIcon name="chevron" />
          <Link href="/games/gomoku">게임</Link>
          <LobbyIcon name="chevron" />
          {create ? (
            <>
              <Link href="/games/gomoku">{name}</Link>
              <LobbyIcon name="chevron" />
              <span>방 만들기</span>
            </>
          ) : (
            <span>{name}</span>
          )}
        </nav>
        <div className={styles.heroHeading}>
          <RoomArtwork />
          <div>
            <h1 id="gomoku-title">
              {name} {create ? "방 만들기" : "방 목록"}
            </h1>
            <p>
              {game?.summary ?? (error ? "게임 정보를 확인할 수 없어요." : "게임 정보를 확인하고 있어요.")}
            </p>
            <span>
              {create
                ? "간단한 설정으로 바로 시작할 수 있어요."
                : "다양한 규칙과 설정의 방을 찾아보거나, 직접 방을 만들어보세요."}
            </span>
            {/* 장르 이름·순서는 관리자 연결을 따르고 긴 설명은 펼쳐서 읽을 수 있게 한다. */}
            {game && <>
              {game.genres.length > 0 && <div className={styles.catalogGenres} aria-label="게임 장르">
                {game.genres.map(genre => <span key={genre.code}>{genre.name}</span>)}
              </div>}
              {game.description && <details className={styles.catalogDescription}>
                <summary>게임 소개</summary><p>{game.description}</p>
              </details>}
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}
