"use client";

import { useRef, useState } from "react";
import { AuthRequestError, logout } from "@/features/auth/client/api";
import styles from "../home.module.css";

/** 서버 세션과 쿠키 정리가 완료된 뒤 로그인 화면을 새 문서로 연다. */
export function LogoutButton({ sessionId }: { sessionId: string }) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      // 실제로 표시한 세션만 종료한다. 다른 탭이 계정을 바꿨다면 서버가 변경 요청을 거절한다.
      await logout(sessionId);
      window.location.replace("/login");
    } catch (error) {
      // 서버 장애로 세션 정리가 실패했다면 화면에서 재시도할 수 있게 한다.
      setMessage(error instanceof AuthRequestError ? error.message : "로그아웃하지 못했습니다. 다시 시도해 주세요.");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <button className={styles.button} type="button" onClick={handleLogout} disabled={pending} aria-describedby="logout-status">
        {pending ? "로그아웃 중…" : "로그아웃"}
      </button>
      <p id="logout-status" role="status" className={styles.status}>{message}</p>
    </div>
  );
}
