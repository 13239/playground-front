import Image from "next/image";
import bannerArtwork from "../../../../public/images/lobby/playground-banner.webp";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 배너 문구는 이미지에 굽지 않고 HTML로 제공하여 작은 화면과 보조 기술에서도 읽을 수 있게 한다. */
export function HeroBanner({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className={styles.hero} aria-labelledby="lobby-title">
      {/* 정적 이미지의 콘텐츠 해시로 교체 이력을 캐시에 반영하고, 모바일의 확대된 삽화에도 충분한 해상도를 제공한다. */}
      <div className={styles.heroArtwork}>
        <Image
          className={styles.heroArt}
          src={bannerArtwork}
          alt="파스텔 구름 위에서 보라색 게임패드를 들고 손을 흔드는 하얀 캐릭터와 웃는 보라색 친구"
          fill
          sizes="(min-width: 2560px) 2060px, (min-width: 1150px) 76vw, (max-width: 600px) 1080px, 100vw"
          quality={95}
          preload
        />
      </div>
      <div className={styles.heroShade} aria-hidden="true" />
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
    </section>
  );
}
