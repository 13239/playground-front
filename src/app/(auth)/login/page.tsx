import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "./_components/brand";
import { Icon } from "./_components/icon";
import { LoginGate } from "./_components/login-gate";
import { NoticeButton } from "./_components/notice-button";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className={styles.screen}>
      <div className={styles.backdrop} aria-hidden="true">
        <Image
          src="/images/auth/playground-world-hq.webp"
          alt=""
          fill
          sizes="(max-aspect-ratio: 16/9) 177.78vh, 100vw"
          quality={95}
          preload
          className={styles.worldImage}
        />
      </div>

      <a className={styles.skipLink} href="#login-title">
        로그인 폼으로 바로가기
      </a>

      <header className={styles.header}>
        <Link href="/" className={styles.homeLink} aria-label="Playground 홈">
          <Brand gradientId="header-gamepad" />
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="login-title">
          <h1 id="login-title" className={styles.cardBrand} tabIndex={-1}>
            <Brand gradientId="card-gamepad" />
            <span className={styles.srOnly}>로그인</span>
          </h1>

          {/* 이미 로그인한 사용자는 브라우저 증명을 확인한 뒤 홈으로 이동한다. */}
          <LoginGate />

          <footer className={styles.cardFooter}>
            <span>아직 계정이 없으신가요?</span>
            <NoticeButton kind="signup" className={styles.signupLink}>
              회원가입
              <Icon name="arrow" />
            </NoticeButton>
          </footer>
        </section>
      </main>
    </div>
  );
}
