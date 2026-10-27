import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AuthSessionObserver } from "@/features/auth/client/auth-session-observer";
import { ChatProvider } from "@/features/chat/client/chat-provider";
import { SocialProvider } from "@/features/social/social-provider";
import { getAppEnvironment } from "@/lib/server/env";
import "./globals.css";

const notoSansKr = localFont({
  src: "./fonts/noto-sans-kr.woff2",
  variable: "--font-noto-sans-kr",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Playground",
    template: "%s | Playground",
  },
  description: "새로운 즐거움이 시작되는 곳, Playground.",
};

export const viewport: Viewport = {
  themeColor: "#eaf2ff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // nonce가 있는 HTML은 요청별로 렌더링한다. 보호된 사용자 데이터는 여기서 읽지 않는다.
  await headers();
  // 공개 배포 모드만 전달한다. 최종 개인키 검증 여부는 BFF와 Spring의 서버 설정으로 별도 강제한다.
  const authMode = getAppEnvironment() === "dev" ? "dev-http" : "bound";
  return (
    <html lang="ko" className={notoSansKr.variable} data-auth-mode={authMode}>
      <body>
        {/* 공통 레이아웃의 구독은 페이지 이동에도 유지하며 보호 데이터는 브라우저 검증 뒤 기존 화면에서만 표시한다. */}
        <AuthSessionObserver />
        {/* 공용 채팅은 홈에 머무르는 동안만 공유하고 페이지를 떠나면 정리한다. 방 채팅은 별도로 관리한다. */}
        {/* 바깥 틀은 화면 폭이다. 본문 상한은 각 페이지가 정하고 내용 높이는 문서 흐름으로 결정한다. */}
        {/* 친구·그룹 대화와 알림은 로그인 동안 페이지 이동에도 유지하고, 전체 채팅은 기존 홈 수명을 따른다. */}
        <SocialProvider><ChatProvider><div className="app-pages">{children}</div></ChatProvider></SocialProvider>
      </body>
    </html>
  );
}
