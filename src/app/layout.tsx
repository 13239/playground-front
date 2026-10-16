import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body>{children}</body>
    </html>
  );
}
