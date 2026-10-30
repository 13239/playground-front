import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../_components/brand";
import { Icon } from "../_components/icon";
import { LoginGate } from "./_components/login-gate";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string | string[] }>;
}) {
  // 완료 표시는 공개 안내일 뿐이며 쿠키나 로그인 여부의 근거로 사용하지 않는다.
  const registered = (await searchParams).registered === "1";
  return (
    <>
      <h1 id="auth-title" className={styles.cardBrand} tabIndex={-1}>
        <Brand gradientId="card-gamepad" />
        <span className={styles.srOnly}>로그인</span>
      </h1>

      {/* 이미 로그인한 사용자는 브라우저 증명을 확인한 뒤 홈으로 이동한다. */}
      <LoginGate registered={registered} />

      <footer className={styles.cardFooter}>
        <span>아직 계정이 없으신가요?</span>
        <Link href="/sign-up" className={styles.signupLink}>
          회원가입
          <Icon name="arrow" />
        </Link>
      </footer>
    </>
  );
}
