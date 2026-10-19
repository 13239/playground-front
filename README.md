# Playground Frontend

Next.js 16.4 App Router와 React 19를 사용한다. 로그인은 브라우저 → Next.js BFF → Spring API 흐름으로 연결한다.

## 실행

```sh
npm ci
npm run dev
```

설정 예제인 `.env.example`을 `.env.local`로 복사하고 `AUTH_COOKIE_SECRET`에 별도의 32바이트 무작위 Base64 키를 지정한다. 키 생성 명령은 예제에 있다. 실제 키가 있는 환경 파일은 Git에 포함하지 않는다.

| 환경 변수 | 용도 |
| --- | --- |
| `BACKEND_ORIGIN` | Spring 내부 주소. 경로·쿼리·사용자 정보가 없는 HTTP(S) Origin |
| `APP_ORIGIN` | 브라우저가 접속하는 공개 Origin. 운영에서는 HTTPS 사용 |
| `BACKEND_TIMEOUT_MS` | Spring 요청 전체 제한 시간. 기본 10,000ms, 범위 100~30,000ms |
| `AUTH_COOKIE_SECRET` | Spring JWT 서명 키와 분리한 BFF 쿠키 암호화 키 |

운영 BFF 인스턴스는 동일한 암호화 키와 공개 Origin을 사용한다. 쿠키 암호화 키를 바꾸면 기존 인증 쿠키는 무효화된다. 위 변수들은 서버 전용이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 폴더 구성

```text
src/
  app/
    (auth)/login/
      _components/          # 로그인 화면 전용 UI
      login.module.css
      page.tsx
    fonts/                  # next/font/local에서 사용하는 폰트
    globals.css
    layout.tsx
    page.tsx
  features/auth/
    types.ts                # 브라우저에 제공할 수 있는 인증 계약
    server/
      api.ts                # Spring 인증 API 호출
      contracts.ts          # 서버 전용 토큰 계약과 응답 검증
      cookies.ts            # 암호화 인증 쿠키 처리
  lib/server/
    api-error.ts            # 공개 오류 변환
    backend-client.ts       # 캐시·재시도 없는 Spring 통신
    env.ts                  # 서버 환경 변수 검증
    request-security.ts     # 쿠키 변경 요청의 Origin 검증
```

`src/app`, route group, `_components`는 Next.js 공식 규칙에 맞춰 유지한다. 여러 경로에서 공유할 인증 로직은 `features/auth`, 여러 기능이 공유할 서버 기반은 `lib/server`에 둔다. 서버 모듈은 각각 `server-only`로 보호하고 클라이언트용 모듈과 섞는 통합 재내보내기 파일을 만들지 않는다.

## BFF 인증 규칙

- 브라우저용 Route Handler는 요청을 검증한 뒤 서버 전용 인증 API를 호출한다. Server Component는 자신의 Route Handler로 우회하지 않고 같은 서버 모듈을 직접 호출한다.
- 로그인·갱신 응답의 토큰은 서버 내부에서만 다루고 브라우저 JSON·Client Component props·브라우저 저장소·로그로 전달하지 않는다.
- 인증 쿠키는 `jose`의 JWE 인증 암호화를 사용한다. `HttpOnly`, `SameSite=Lax`, `Path=/`를 적용하고 운영에서는 `Secure`와 `__Host-` 접두사를 사용한다.
- 유지 ON의 로그인 복원용 쿠키는 Spring이 반환한 Redis 세션 만료 시각까지 영속 저장한다. OFF에는 `Expires`·`Max-Age`를 설정하지 않는다. 브라우저의 세션 복원 기능은 세션 쿠키를 복원할 수 있다.
- Access Token 만료와 Redis 세션 만료는 구분한다. 토큰 갱신 시 세션 만료에 시간을 더하지 않고, 실제 활동이 Spring에서 승인된 경우에만 쿠키 만료도 맞춘다.
- 쿠키 복호화는 사용자 인증 판별이 아니다. 사용자 판별은 `/api/auth/session`의 JWT·최신 Redis 검증 결과를 사용하며 인증 정보를 공용 캐시에 저장하지 않는다.
- 쿠키 변경은 Route Handler 또는 Server Action에서 수행한다. Route Handler의 변경 요청은 `assertSameOrigin`으로 보호하고, 사용자 정보 읽기는 Cache Components의 요청 시점 `Suspense` 경계를 고려한다.
- Spring으로 브라우저의 Cookie·Authorization·전달 헤더를 일괄 전달하지 않는다. 자동 리다이렉트와 자동 재시도도 하지 않는다. 로그인 IP 전달은 다음 로그인 연결 단계에서 신뢰할 프록시 구성을 기준으로 처리한다.
- 네트워크 장애·시간 초과·인증 만료를 구분하고, 내부 오류 원문은 브라우저에 노출하지 않는다.

현재 단계는 서버 통신과 인증 쿠키의 공통 기반이다. 로그인 화면에 연결할 BFF Route Handler, 자동 갱신 조율 및 사용자 활동 감지는 후속 단계에서 연결한다.

## 확인

```sh
npm run lint
npx tsc --noEmit
npm run build
```

UI 폰트는 `next/font/local`로 로드하는 Noto Sans KR을 사용한다.
