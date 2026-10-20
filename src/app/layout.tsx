import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { headers } from "next/headers";
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
      <body>{children}</body>
    </html>
  );
}
