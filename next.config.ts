import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Docker 실행 이미지에는 Next 서버와 실제 사용하는 의존성만 포함한다.
  output: "standalone",
  // 게임 서버와 같은 순수 TypeScript 전투 계약을 사용한다. Phaser 자체는 게임 진입 뒤 지연 로딩한다.
  transpilePackages: ["@playground/shooting-shared"],
  // 형제 폴더의 공유 계약도 개발 감시·standalone 추적에 포함한다.
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  turbopack: { root: path.resolve(process.cwd(), "..") },
  // 요청별 CSP nonce는 정적 HTML/PPR에 재사용할 수 없다. 정적 JS·CSS·이미지 캐시는 유지한다.
  cacheComponents: false,
  reactCompiler: true,
  experimental: {
    // 개발 캐시 재사용 후 수정 없는 HMR 전체 재시작이 반복된 현상을 막는다. 실행 중 메모리 캐시는 유지한다.
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    qualities: [75, 95],
  },
};

export default nextConfig;
