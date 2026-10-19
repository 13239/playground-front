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
| `TRUSTED_CLIENT_IP_HEADER` | 신뢰 프록시가 덮어쓰는 단일 접속 IP 헤더. 로컬 직접 접속 시 비움 |

운영 BFF 인스턴스는 동일한 암호화 키와 공개 Origin을 사용한다. 쿠키 암호화 키를 바꾸면 기존 인증 쿠키는 무효화된다. 위 변수들은 서버 전용이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 폴더 구성

```text
src/
  app/
    api/auth/
      login/route.ts        # 로그인 검증 및 인증 쿠키 발급
      session/route.ts      # JWT·최신 Redis 기반 세션 확인
      logout/route.ts       # 서버 세션 해제 및 쿠키 삭제
    (auth)/login/
      _components/          # 로그인 화면 전용 UI
      login.module.css
      page.tsx
    fonts/                  # next/font/local에서 사용하는 폰트
    _components/            # 홈의 세션 표시·로그아웃 UI
    home.module.css
    globals.css
    layout.tsx
    page.tsx
  features/auth/
    types.ts                # 브라우저에 제공할 수 있는 인증 계약
    client/api.ts           # 동일 Origin BFF 로그인·로그아웃 호출
    server/
      api.ts                # Spring 인증 API 호출
      contracts.ts          # 서버 전용 토큰 계약과 응답 검증
      cookies.ts            # 암호화 인증 쿠키 처리
      login-input.ts        # Spring 로그인 DTO에 맞춘 입력 검증
      session.ts            # 요청별 최신 인증 상태 조회
  lib/server/
    api-error.ts            # 공개 오류 변환
    backend-client.ts       # 캐시·재시도 없는 Spring 통신
    client-ip.ts            # 명시적으로 신뢰한 프록시의 단일 IP 검증
    env.ts                  # 서버 환경 변수 검증
    request-security.ts     # 쿠키 변경 요청의 Origin 검증
    request-body.ts         # JSON 형식·실제 본문 크기 제한
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
- Spring으로 브라우저의 Cookie·Authorization·전달 헤더를 일괄 전달하지 않는다. 자동 리다이렉트와 자동 재시도도 하지 않는다. 로그인 IP는 `TRUSTED_CLIENT_IP_HEADER`가 지정된 경우 해당 단일 IP만 검증하여 `X-Real-IP`로 전달한다.
- 네트워크 장애·시간 초과·인증 만료를 구분하고, 내부 오류 원문은 브라우저에 노출하지 않는다.

## 로그인 흐름

- 로그인 폼은 `/api/auth/login`에 JSON을 전송한다. BFF는 Origin, 4KiB 본문 제한, 필수값·길이를 검사한 뒤 Spring을 호출한다. 성공 시 암호화 쿠키만 발급하고 본문 없는 `204`를 반환한다.
- 폼은 중복 제출을 막고 로그인 시도 제한의 `Retry-After` 대기 시간을 표시한다. 실패한 비밀번호는 지우고 아이디와 유지 선택은 보존한다.
- 성공하면 `/`를 새 문서로 열어 이전 Router Cache를 비운다. 홈은 `Suspense` 안에서 서버 인증 모듈을 직접 호출하고 검증된 사용자 이름과 로그아웃 버튼을 표시한다. 인증이 없으면 `/login`으로 보낸다.
- `/api/auth/session`은 토큰을 제외한 현재 세션만 반환한다. 호출 자체는 활동으로 취급하지 않으며 쿠키와 Redis 만료를 연장하지 않는다.
- `/api/auth/logout`은 Spring 세션 해제 후 쿠키를 지운다. 이미 인증이 만료·폐기된 경우에도 로컬 쿠키는 지우며, 서비스 장애인 경우에는 실패를 표시하고 쿠키를 보존해 재시도할 수 있게 한다.

자동 Access Token 갱신·동시 갱신 조율과 사용자 활동 감지는 다음 단계다. 현재는 Access Token 만료 시 세션 확인이 `401`을 반환한다. 만료된 Access Token으로 로그아웃하면 브라우저 쿠키만 지워질 수 있으며, 이 경우 Redis 세션은 기존 만료 시각까지 남는다. 갱신 연결 단계에서 만료 후 서버 로그아웃도 함께 처리한다. 테스트용 Access Token 기간은 변경하지 않는다.

## 배포 시 로그인 IP 전달

운영에서는 BFF 앞의 신뢰 프록시가 외부에서 온 헤더를 제거하고 실제 접속 IP 하나로 지정 헤더를 **덮어써야** 한다. 해당 프록시를 우회하여 BFF에 직접 접속할 수 없게 하고 `TRUSTED_CLIENT_IP_HEADER`를 지정한다. 단순히 클라이언트가 보낸 `X-Forwarded-For`의 첫 값을 신뢰하도록 설정하지 않는다. Spring API도 BFF를 통해서만 접근하도록 제한한다.

변수가 비어 있으면 IP 헤더를 전달하지 않으므로 Spring은 BFF의 연결 IP를 기준으로 제한한다. 이 기본값은 직접 접속하는 로컬 개발용이며, 운영에서 사용자별 IP 제한을 적용하려면 위 프록시 구성을 완료해야 한다.

## 확인

```sh
npm run lint
npx tsc --noEmit
npm run build
```

UI 폰트는 `next/font/local`로 로드하는 Noto Sans KR을 사용한다.
