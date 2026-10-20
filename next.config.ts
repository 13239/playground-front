import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 실행 이미지에는 Next 서버와 실제 사용하는 의존성만 포함한다.
  output: "standalone",
  // 요청별 CSP nonce는 정적 HTML/PPR에 재사용할 수 없다. 정적 JS·CSS·이미지 캐시는 유지한다.
  cacheComponents: false,
  reactCompiler: true,
  images: {
    qualities: [75, 95],
  },
};

export default nextConfig;
