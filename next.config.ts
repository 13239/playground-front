import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 요청별 CSP nonce는 정적 HTML/PPR에 재사용할 수 없다. 정적 JS·CSS·이미지 캐시는 유지한다.
  cacheComponents: false,
  reactCompiler: true,
  images: {
    qualities: [75, 95],
  },
};

export default nextConfig;
