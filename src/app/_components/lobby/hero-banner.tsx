import Image from "next/image";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 배너 문구는 이미지에 굽지 않고 HTML로 제공하여 작은 화면과 보조 기술에서도 읽을 수 있게 한다. */
export function HeroBanner({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className={styles.hero} aria-labelledby="lobby-title">
      <Image
        className={styles.heroArt}
        src="/images/lobby/playground-banner.webp"
        alt="푸른 게임 도시에서 반갑게 손을 내미는 플레이그라운드 캐릭터들"
        fill
        sizes="(min-width: 2560px) 2060px, (min-width: 1150px) 76vw, 100vw"
        preload
      />
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <p className={styles.heroEyebrow}>
          <span /> PLAY, CONNECT &amp; ENJOY
        </p>
        <h1 id="lobby-title">
          함께 즐기는
          <br />
          <span>플레이그라운드</span>
        </h1>
        {/* 배너 설명은 가볍게 즐기는 미니게임을 소개하는 두 문장으로 제공한다. */}
        <p className={styles.heroDescription}>
          심심할 땐, 한 판.
          <br />
          잠깐 즐기기 좋은 미니게임.
        </p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onBrowse}
        >
          <LobbyIcon name="gamepad" />
          게임 둘러보기
          <LobbyIcon name="arrow" />
        </button>
      </div>
      <div className={styles.bannerLabel}>
        <span /> OUR PLAYGROUND, YOUR PLAYTIME
      </div>
    </section>
  );
}
