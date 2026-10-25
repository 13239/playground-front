import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../_components/brand";
import { Icon } from "../_components/icon";
import { SignUpGate } from "./_components/sign-up-gate";
import styles from "../auth.module.css";
import signUpStyles from "./sign-up.module.css";

export const metadata: Metadata = {
  title: "회원가입",
  robots: { index: false, follow: false },
};

/** 가입에는 닉네임·아이디·비밀번호만 요청하고 기존 로그인과 같은 인증 경계를 사용한다. */
export default function SignUpPage() {
  return (
    <>
      <div className={signUpStyles.brand}><Brand gradientId="sign-up-gamepad" /></div>
      <h1 id="auth-title" className={signUpStyles.title} tabIndex={-1}>회원가입</h1>
      <p className={signUpStyles.description}></p>
      <SignUpGate />
      <footer className={styles.cardFooter}>
        <span>이미 계정이 있으신가요?</span>
        <Link href="/login" className={styles.signupLink}>
          로그인<Icon name="arrow" />
        </Link>
      </footer>
    </>
  );
}
