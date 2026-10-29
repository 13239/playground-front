# syntax=docker/dockerfile:1

# Linux 안에서 의존성을 설치하여 Windows의 node_modules·네이티브 모듈을 복사하지 않는다.
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app/front/playground
# 공유 전투 계약 때문에 저장소 루트를 빌드 컨텍스트로 사용한다.
COPY game/playground/packages/shooting-shared /app/game/playground/packages/shooting-shared
COPY front/playground/package.json front/playground/package-lock.json ./
# 빌드는 잠금 파일대로 설치만 수행하며 별도 의존성 감사 요청은 자동 전송하지 않는다.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS builder
WORKDIR /app/front/playground
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP_ENV=dev APP_ORIGIN=http://localhost:3000
COPY front/playground .
# 실제 배포 주소·비밀값은 이미지에 포함하지 않고 Compose 실행 시 공급한다.
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/front/playground/.next/standalone ./
COPY --from=builder --chown=node:node /app/front/playground/.next/static ./front/playground/.next/static
COPY --from=builder --chown=node:node /app/front/playground/public ./front/playground/public
RUN mkdir -p front/playground/.next/cache && chown node:node front/playground/.next/cache
USER node
EXPOSE 3000
# standalone 서버는 next start 대신 생성된 진입점을 사용한다.
CMD ["node", "front/playground/server.js"]
