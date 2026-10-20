# Playground Frontend

Next.js 16.4 App Router와 React 19를 사용한다. 로그인은 브라우저 → Next.js BFF → Spring API 흐름으로 연결하며, HttpOnly 쿠키에 더해 브라우저 키 소유를 검증한다.

## 실행

```sh
npm ci
npm run dev
```

설정 예제인 `.env.example`을 `.env.local`로 복사하고 `AUTH_COOKIE_SECRET`에 별도의 32바이트 무작위 Base64 키를 지정한다. 키 생성 명령은 예제에 있다. 실제 키가 있는 환경 파일은 Git에 포함하지 않는다.

| 환경 변수 | 용도 |
| --- | --- |
| `BACKEND_ORIGIN` | Spring 내부 주소. 로컬 기본값은 `http://localhost:9080`. 경로·쿼리·사용자 정보가 없는 HTTP(S) Origin |
| `APP_ORIGIN` | 브라우저가 접속하는 공개 Origin. 운영에서는 HTTPS 사용 |
| `BACKEND_TIMEOUT_MS` | Spring 요청 전체 제한 시간. 기본 10,000ms, 범위 100~30,000ms |
| `AUTH_COOKIE_SECRET` | Spring JWT 서명 키와 분리한 BFF 쿠키 암호화 키 |
| `TRUSTED_CLIENT_IP_HEADER` | 신뢰 프록시가 덮어쓰는 단일 접속 IP 헤더. prod는 필수이며 시작 시 검증. local/dev 직접 접속 시 비움 |
| `BACKEND_CA_CERT_PATH` | 운영 Spring 서버 인증서를 검증할 전용 CA PEM 파일의 절대 경로 |
| `BFF_CLIENT_CERT_PATH`, `BFF_CLIENT_KEY_PATH` | 운영 BFF 클라이언트 인증서·개인키 PEM 파일의 절대 경로 |

운영 BFF 인스턴스는 동일한 암호화 키와 공개 Origin을 사용한다. 쿠키 암호화 키를 바꾸면 기존 인증 쿠키는 무효화된다. 위 변수들은 서버 전용이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

운영 `APP_ENV=prod`는 `BACKEND_ORIGIN=https://내부서버:9080`과 mTLS 파일 세 개가 필수이며, 인증서 오류를 무시하거나 HTTP로 우회하지 않는다. Node 표준 HTTPS의 연결 풀을 사용하며 인증서 교체 후 BFF를 재시작한다. `APP_ENV=local`의 HTTP 연결은 실제 루프백 주소에만 허용한다. Spring도 같은 환경의 프로필로 실행하며 인증서·방화벽·개발 배포 설정은 [백엔드 안내](../playground-back/README.md)를 따른다.

## 개발 서버의 원격 HTTP

개발 배포는 `APP_ENV=dev`, `APP_ORIGIN=http://123.234.123.222:9081`, `BACKEND_ORIGIN=http://backend:9080`으로 설정하고 Spring에도 `SPRING_PROFILES_ACTIVE=dev`와 같은 공개 Origin을 지정한다. 제공한 Compose는 호스트 9081 → Nginx → 프론트/BFF 3000으로 연결하고 실제 접속 IP를 덮어써 전달한다. Spring의 9080은 내부 전용이며 사용자에게 직접 노출하지 않는다. Next는 `next build`의 standalone 서버를 실행하고 `NODE_ENV`를 임의 값 `dev`로 바꾸지 않는다. 기존 개발 서버 MySQL·Redis를 사용하는 이미지 묶음 생성과 서버 직접 실행 순서는 [Linux 직접 배포 안내](../deploy/README.md)를 따른다.

원격 HTTP 브라우저에서는 개인키 API를 사용할 수 없어 dev만 일반 BFF+JWT로 동작한다. 서버 설정이 dev일 때만 키 검증을 생략하고 HTTP 쿠키를 발급하며 CSP의 HTTPS 강제와 HSTS만 끈다. 스크립트 nonce·안전한 출력·Origin·JWT·Redis 세션 검증은 유지한다. 탭 사이 변경은 HTTP에서도 쓸 수 있는 IndexedDB 임대로 직렬화한다. dev HTTP는 전송 암호화와 쿠키 탈취에 대한 개인키 방어를 제공하지 않는다.

Spring과 BFF에 동일한 별도 무작위 `BFF_DEV_SHARED_SECRET`을 공급한다. 공유 키는 내부 HTTP의 BFF 인증에만 사용하고 브라우저에는 내보내지 않는다. JWT·쿠키 키와 각각 다르게 생성하고 운영과도 공유하지 않는다. 공개 모드 표시를 브라우저에서 바꿔도 prod의 서버 검증을 생략할 수 없다.

## 폴더 구성

```text
src/
  app/
    api/auth/
      sign-up/route.ts      # 가입 필수 세 항목 검증 및 본문 없는 201 응답
      login/route.ts        # 로그인 검증 및 인증 쿠키 발급
      session/route.ts      # JWT·최신 Redis 기반 세션 확인
      logout/route.ts       # 서버 세션 해제 및 쿠키 삭제
      refresh/route.ts      # 동일 Origin POST에서만 토큰 갱신
      proof-challenge/route.ts # 토큰을 노출하지 않는 공개 nonce 발급
      activity/route.ts     # 브라우저 키로 증명한 실제 활동의 만료 연장
    (auth)/
      _components/          # 공통 브랜드·아이콘·최신 세션 기반 비회원 판별
      auth.module.css       # 공통 배경·카드·입력 스타일
      layout.tsx
      login/
        _components/        # 로그인 폼·안내 UI
        page.tsx
      sign-up/
        _components/        # 세 항목 가입 폼·입력 및 서버 오류 안내
        sign-up.module.css
        page.tsx
    fonts/                  # next/font/local에서 사용하는 폰트
    _components/            # 홈의 세션 표시·로그아웃 UI
      lobby/                # 배너·카테고리·오목 카드·채팅 패널·계정 메뉴
    home.module.css
    globals.css
    layout.tsx
    page.tsx
  features/auth/
    types.ts                # 브라우저에 제공할 수 있는 인증 계약
    sign-up-validation.ts   # 브라우저·BFF 공통 가입 검증, Spring과 같은 코드 포인트 길이
    client/sign-up.ts       # 가입 요청 한 번 전송, 개인정보 저장·자동 재시도 없음
    client/api.ts           # 탭 사이 잠금·키 증명·필요 시 한 번만 갱신
    client/session-events.ts # 인증 정보 없는 탭 변경 알림과 저장소 대체 경로
    client/session-store.ts  # 탭 복귀·인증 변경·bfcache 복원 시 세션 재확인
    client/browser-key.ts   # 추출 불가 개인키의 IndexedDB 보관
    client/browser-proof.ts # 짧은 nonce와 ES256 요청 증명
    client/error.ts         # 브라우저에서 공유하는 공개 오류
    request-binding.ts      # 비밀번호를 제외한 로그인 요청 결합 규칙
    server/
      api.ts                # Spring 인증 API 호출
      contracts.ts          # 서버 전용 토큰 계약과 응답 검증
      cookies.ts            # 암호화 인증 쿠키 처리
      login-input.ts        # Spring 로그인 DTO에 맞춘 입력 검증
      mutation-input.ts     # 활동·로그아웃 화면의 세션 결합 검증
      session.ts            # 요청별 최신 인증 상태 조회
      refresh.ts            # 명시적 쿠키 갱신과 증명이 필요한 인증 호출 분리
      browser-proof.ts      # 실제 요청의 증명과 본문 결합 해시 준비
  lib/server/
    api-error.ts            # 공개 오류 변환
    backend-client.ts       # 캐시·재시도 없는 Spring 통신
    backend-transport.ts    # Node HTTPS 연결 풀·mTLS·응답 크기 제한
    client-ip.ts            # 명시적으로 신뢰한 프록시의 단일 IP 검증
    env.ts                  # 서버 환경 변수 검증
    request-security.ts     # 쿠키 변경 요청의 Origin 검증
    request-body.ts         # JSON 형식·실제 본문 크기 제한
  proxy.ts                  # HTML/RSC마다 새로운 CSP nonce
  instrumentation.ts        # 운영의 필수 IP 전달 설정을 서버 시작 시 확인
```

`src/app`, route group, `_components`는 Next.js 공식 규칙에 맞춰 유지한다. 여러 경로에서 공유할 인증 로직은 `features/auth`, 여러 기능이 공유할 서버 기반은 `lib/server`에 둔다. 서버 모듈은 각각 `server-only`로 보호하고 클라이언트용 모듈과 섞는 통합 재내보내기 파일을 만들지 않는다.

## BFF 인증 규칙

아래의 브라우저 개인키·nonce·Web Locks 절차는 local/prod에 적용한다. dev의 서명 생략·HTTP 쿠키·IndexedDB 잠금 예외는 위 개발 서버 절을 따른다.

- 브라우저용 Route Handler는 요청을 검증한 뒤 서버 전용 인증 API를 호출한다. 서버 HTML/RSC는 공통 화면 틀만 제공하고 사용자 데이터는 키 증명이 있는 브라우저 요청으로 가져온다. Server Component에서 쿠키만으로 사용자 데이터를 가져오는 우회 경로를 두지 않는다.
- 로그인·갱신 응답의 토큰은 서버 내부에서만 다루고 브라우저 JSON·Client Component props·브라우저 저장소·로그로 전달하지 않는다.
- 인증 쿠키는 `jose`의 JWE 인증 암호화를 사용한다. `HttpOnly`, `SameSite=Lax`, `Path=/`를 적용하고 운영에서는 `Secure`와 `__Host-` 접두사를 사용한다.
- 유지 ON의 로그인 복원용 쿠키는 Spring이 반환한 Redis 세션 만료 시각까지 영속 저장한다. OFF에는 `Expires`·`Max-Age`를 설정하지 않는다. 브라우저의 세션 복원 기능은 세션 쿠키를 복원할 수 있다.
- Access Token 만료와 Redis 세션 만료는 구분한다. 토큰 갱신 시 세션 만료에 시간을 더하지 않고, 실제 활동이 Spring에서 승인된 경우에만 쿠키 만료도 맞춘다.
- 쿠키 복호화는 사용자 인증 판별이 아니다. 사용자 판별은 `/api/auth/session`의 JWT·최신 Redis·브라우저 키 검증 결과를 사용하며 인증 정보를 공용 캐시에 저장하지 않는다. 키 지문이 포함된 쿠키 v2만 허용한다.
- 쿠키 변경은 Route Handler에서 수행한다. 변경 요청은 `assertSameOrigin`으로 보호하고 조회를 포함한 보호 API에는 `X-Browser-Proof`를 요구한다. 프록시/프리패치 검사를 인증으로 대체하지 않는다.
- Spring으로 브라우저의 Cookie·Authorization·전달 헤더를 일괄 전달하지 않는다. 자동 리다이렉트와 자동 재시도도 하지 않는다. 로그인 IP는 `TRUSTED_CLIENT_IP_HEADER`가 지정된 경우 해당 단일 IP만 검증하여 `X-Real-IP`로 전달한다. prod는 이 설정이 없으면 시작을 거절하고, 요청의 지정 헤더가 없거나 잘못되면 요청을 거절한다.
- 네트워크 장애·시간 초과·인증 만료를 구분하고, 내부 오류 원문은 브라우저에 노출하지 않는다.
- Spring의 DB·Redis 인증 서비스 장애는 필터·MVC 경로 모두 `503 AUTH_SERVICE_UNAVAILABLE`로 전달한다. BFF는 이를 토큰 갱신·쿠키 삭제·로그인 화면 이동의 근거로 사용하지 않으며 재시도를 안내한다.

## 로그인 흐름

- 로그인 폼은 Web Crypto로 P-256 키를 준비하고 로그인 nonce를 받아 `/api/auth/login`에 JSON과 ES256 증명을 전송한다. BFF는 Origin, 4KiB 본문 제한, 필수값·길이와 증명 형식을 검사한 뒤 Spring에 전달한다. Spring은 nonce·요청 서명과 비밀번호를 검증하고 공개키 지문을 세션에 등록한다. 성공 시 BFF는 암호화 쿠키만 발급하고 본문 없는 `204`를 반환한다.
- 로그인 페이지는 쿠키의 존재가 아닌 키·최신 Redis 검증으로 기존 로그인을 확인하고 홈으로 보낸다. 폼을 오래 열어 두어도 제출 잠금 안에서 한 번 더 확인해 다른 탭의 로그인을 덮어쓰지 않는다. 확인 중에는 폼 DOM과 입력값을 유지하되 제출을 막는다.
- JWT 서명 키 교체로 이전 Refresh Token을 검증할 수 없으면 기존 세션 교체만 생략하고, 정상 비밀번호 인증은 신규 로그인으로 진행한다. 무효 토큰으로 이전 세션을 삭제하거나 기존 쿠키를 새 인증의 근거로 사용하지 않는다.
- 재로그인은 기존 암호화 쿠키에서만 `previousRefreshToken`과 서버 생성 `previousRefreshRequestId`를 준비한다. 브라우저 JSON의 교체 증명은 전달하지 않는다. Spring은 비밀번호 인증 성공 후 Lua에서 기존 토큰 증명을 검증하고 이전 세션 제거·최대 3개 제한·새 세션 등록을 함께 처리한다. 같은 계정의 비밀번호 재인증 또는 같은 브라우저 키 소유를 증명한 경우에만 이전 세션을 교체한다. 다른 계정의 비밀번호와 훔친 쿠키만으로 피해자 세션을 삭제할 수 없다.
- 같은 이전 쿠키·로그인 계정·유지 선택·브라우저 키의 동시 요청은 암호화한 로그인 결과를 최대 60초 공유한다. 현재 새 세션의 토큰 해시·소유자·만료·목록을 다시 확인하고, 다른 계정·유지 선택·키 또는 이후 인증 변경과 충돌하면 `409 LOGIN_SESSION_CHANGED`를 반환하며 쿠키를 변경하지 않는다. 로그인 직전에 갱신이 겹친 경우에는 기존 60초 갱신 공유 결과도 교체 증명으로 확인한다.
- 교체 증명이 없거나 이전 세션이 이미 종료되었다면 신규 로그인으로 처리하며 기존 최대 3개 제한을 적용한다. 비밀번호 인증 실패·계정 차단 시 이전 세션은 변경하지 않는다. 로그인 공유 결과는 `auth:login-result:*`에 인증 암호문과 검증용 해시만 저장하며 세션 수명을 연장하지 않는다. 서명된 갱신 토큰 계약은 아래 배포 조건에 맞춰 Spring과 BFF에 함께 적용한다.
- 폼은 중복 제출을 막고 로그인 시도 제한의 `Retry-After` 대기 시간을 표시한다. 실패한 비밀번호는 지우고 아이디와 유지 선택은 보존한다.
- 성공하면 `/`를 새 문서로 열어 이전 Router Cache를 비운다. 홈은 서버에서 사용자 데이터를 읽지 않고 브라우저가 키를 증명해 세션을 조회한 뒤 사용자 이름과 로그아웃 버튼을 표시한다. 인증 또는 키가 없으면 `/login`으로 보낸다.
- `/api/auth/session`은 토큰을 제외한 현재 세션만 반환한다. 호출 자체는 활동으로 취급하지 않으며 쿠키와 Redis 만료를 연장하지 않는다.
- `/api/auth/logout`은 키를 증명한 요청만 Spring 세션을 해제하고 쿠키를 지운다. Access Token이 만료되면 브라우저가 갱신 경로의 새 증명으로 갱신한 뒤 로그아웃을 한 번 다시 요청한다. 이미 만료·폐기된 인증은 로그인 화면으로 안내하고 오래된 쿠키는 다음 로그인으로 교체한다. 서비스 장애는 실패를 표시하고 쿠키를 보존해 재시도할 수 있게 한다.

## 회원가입

로그인의 회원가입 링크에서 `/sign-up`으로 이동한다. 닉네임(1~50자), 아이디(4~50자), 비밀번호(6~72자)만 입력한다. 길이는 Spring의 기존 정책과 동일하게 유니코드 코드 포인트로 계산하고 공백만 있는 입력을 거절한다. 입력 원문은 임의로 자르거나 정규화하지 않는다.

브라우저와 BFF가 필수값·길이를 검증하고 `POST /api/auth/sign-up`이 Spring의 `POST /api/user/sign-up`으로 세 항목만 전달한다. BFF는 동일 Origin·JSON·최대 4KiB 본문을 요구하며 추가 개인정보·ID·계정 상태 필드는 전달하지 않는다. 중복 아이디는 필드 아래에 표시하고 실패 시 비밀번호만 지운다. 로그인된 사용자는 최신 세션 검증 후 홈으로 이동한다.

가입 성공은 본문 없는 `201 Created`로 처리하고 `/login?registered=1`에서 완료 안내를 표시한다. 이 쿼리는 공개 안내일 뿐 인증 여부를 판별하지 않는다. 가입은 쿠키를 발급하지 않으며 아이디·비밀번호를 URL이나 저장소에 남기지 않는다. 가입 요청 제한은 로그인 제한과 분리된 기본 IP별 120회/분이며 `Retry-After` 대기 시간을 표시한다.

## 자동 갱신과 동시 요청

- 세션 조회/변경이 Access Token 만료·무효를 확인하면 브라우저가 `POST /api/auth/refresh`의 새로운 증명으로 갱신한 뒤 원래 경로의 새로운 증명으로 한 번만 재실행한다. 하나의 증명을 다른 경로/메서드에 재사용하지 않는다. 로그인 실패·일반 서비스 장애는 자동 재시도하지 않는다.
- Server Component는 쿠키를 직접 쓰지 않는다. 홈의 `SessionContent`와 로그인 페이지는 공유 세션 저장소에서 최신 세션 확인과 필요한 갱신을 수행하고 `SessionRecovery`가 복구 상태·재시도를 표시한다. 마운트·인증 변경·탭 복귀·bfcache 복원 때 재확인하며 장애 시 사용자가 재시도할 수 있다. 이전 조회의 늦은 응답은 상태 변경 이후 화면에 반영하지 않는다.
- 로그인·로그아웃 변경은 BroadcastChannel과 storage 이벤트로 알리고, 알림에는 토큰·사용자·세션 ID를 넣지 않는다. 탭 알림이 누락되어도 복귀 시 재확인한다. 활동·로그아웃의 JSON에는 화면이 확인한 공개 `sessionId`를 결합하며 BFF가 암호화 쿠키의 실제 세션과 다르면 `409 LOGIN_SESSION_CHANGED`로 거절하고 새 계정의 작업을 실행하지 않는다. 세션 ID는 인증 수단이 아니며 JWT·Redis·Origin·브라우저 증명 검증을 그대로 수행한다. 기존 v2 쿠키는 토큰의 sid를 읽어 같은 계약에 연결한다.
- 한 문서의 명시적 갱신은 진행 중인 Promise를 공유한다. Web Locks로 탭 사이 로그인·갱신·활동 연장·로그아웃의 쿠키 변경 순서를 보장한다. 갱신 잠금을 얻은 뒤 먼저 최신 세션을 확인하여 다른 탭이 이미 갱신한 경우 다시 회전하지 않는다. 키 저장과 잠금을 지원하지 않는 브라우저에서는 보호 기능을 완화하지 않고 로그인을 안내한다. 여러 BFF 서버의 동시 요청은 Spring·Redis의 원자 회전으로 처리한다.
- BFF가 기존 Refresh Token과 쿠키 키로 HMAC 갱신 식별자를 생성한다. Spring의 `RefreshRequest`는 `refreshToken`과 64자리 소문자 hex `requestId`를 요구한다. 브라우저가 제공한 토큰·식별자는 전달하지 않는다.
- Refresh Token은 `sid`·`gen`·무작위 `jti`를 담은 HS256 서명 JWT이며 최대 1,024자로 제한한다. Java 25 HKDF로 Access Token과 다른 서명 키를 파생하고, 갱신 전용 `typ=rt+jwt`·발급자·별도 audience·사용 시작 시각·정수 세대를 검증한 뒤에만 Redis에 접근한다. 로그인은 0세대부터 시작하며 성공한 회전마다 1씩 증가한다.
- 동일한 **직전 세대 토큰·갱신 식별자**의 요청만 회전 한 번의 같은 결과를 **최대 60초** 공유한다. 이 기간은 BFF의 최대 요청 제한 30초보다 길어 응답 유실 후 재시도를 허용하며, 세션 만료와 실제 Redis 세션 TTL을 넘지 않는다. 공유 결과를 읽어도 TTL을 연장하지 않는다.
- 서명 검증을 통과한 이전 세대 토큰이 다른 식별자로 제출되거나, 공유 결과가 만료되거나, 두 세대 이상 지난 토큰이 제출되면 Lua가 해당 세션 Hash·사용자별 목록 항목·공유 결과를 원자적으로 폐기하고 `401 REFRESH_TOKEN_REUSED`를 반환한다. 그 세션의 기존 Access Token도 이후 인증에서 거절한다. 위조 토큰·미래 세대·같은 세대의 해시 불일치는 요청만 거절하며 다른 기기의 세션을 종료하지 않는다.
- Redis에는 현재 토큰 해시·현재 세대와 `auth:refresh-result:<sessionId>`의 최신 결과 **한 건만** 유지한다. 같은 Key를 덮어쓰므로 갱신 횟수에 따른 소비 이력이 쌓이지 않는다. 공유 결과의 토큰은 AES-256-GCM 암호문으로만 저장한다. 서명 키를 직접 재사용하지 않고 Java 25 HKDF로 용도를 분리한 암호화 키를 파생한다. 같은 Redis를 쓰는 Spring 인스턴스는 같은 JWT 키를, 같은 공개 Origin을 서비스하는 BFF 인스턴스는 같은 쿠키 키를 사용해야 한다.
- 결과를 공유할 때도 Lua가 계정 차단·세션 소유자·만료·동시 로그인 목록·현재 Refresh Token 해시·세대를 다시 검증한다. 공유 결과는 사용자 판별용 캐시가 아니며 JWT·최신 Redis 검증을 생략하지 않는다. 사용자 테이블 조회는 추가하지 않는다.
- Spring 응답의 `accessTokenExpiresAt`을 그대로 쿠키에 넣는다. 수신 시점에 `expiresIn`을 다시 더하지 않는다. ON의 세션 만료와 OFF의 세션 쿠키 속성은 그대로 유지하고, 갱신은 Redis 세션 수명을 늘리지 않는다.
- 회전 직후 새 쿠키부터 저장하므로 뒤따르는 로그아웃 등이 장애로 실패해도 새 Refresh Token으로 재시도할 수 있다. 갱신 실패 응답은 다른 요청이 설정한 새 쿠키를 지우지 않는다. 확정된 세션 무효는 로그인 화면으로 안내한다.

활동에 따른 세션 연장은 Spring `/api/auth/activity` 정책을 사용한다. 보이는 탭의 실제 포인터·키·휠·터치 입력에서 최대 분당 한 번 키를 증명해 Redis와 쿠키 만료를 함께 연장한다. 스크립트의 자동 스크롤·폴링·백그라운드 갱신은 활동으로 취급하지 않는다. Refresh Token에는 로그인 시각 기준 고정 `exp`를 넣지 않고 Redis의 최신 활동 기반 만료를 적용하므로 활동 중인 세션에 절대 최대 수명은 없다. 로컬 테스트용 Access Token 기간은 변경하지 않는다.

서명 없는 기존 64자리 Refresh Token·키 미등록 세션·쿠키 v1은 새 계약에서 허용하지 않는다. Spring과 BFF를 함께 배포하고 기존 사용자는 한 번 다시 로그인해야 한다. 기존 쿠키만으로 키를 자동 등록하지 않는다. 이는 계약 전환이며 주기적인 강제 로그아웃 정책은 아니다. 같은 식별자의 60초 재시도는 재사용 폐기의 예외지만, 갱신 요청은 매번 새로운 유효 브라우저 증명도 통과해야 한다.

## 브라우저 키와 XSS 방어

개인키는 `extractable=false`인 `CryptoKey`로만 IndexedDB에 저장하고 공개키만 증명에 포함한다. nonce는 서버가 서명하며 60초 동안 유효하고 브라우저는 목적별로 두 건만 잠시 보관한다. 증명은 요청 메서드·경로·본문 결합 값·서버 nonce·새 증명 ID를 포함한다. 로그인 증명의 본문 결합 값에서는 비밀번호를 제외하여 빠른 비밀번호 해시가 증명에 남지 않게 한다. 비밀번호는 HTTPS/mTLS에서 검증하며 토큰을 JavaScript에 공개하지 않는다. 키 분실은 비밀번호로 다시 로그인하여 복구하고, 기존 쿠키로 서버 키를 변경하는 API는 제공하지 않는다.

Spring은 세션별 증명 ID를 유효 기간에만 저장하며 기본 상한 120건을 넘으면 `429`를 반환한다. 공개 로그인은 IP별 기본 600건(`auth.proof.login-max-pending`)으로 분리한다. nonce 발급은 공개 로그인 IP별 600회/분, 인증된 세션·IP별 120회/분이므로 같은 네트워크의 다른 계정이 세션 nonce 예산을 함께 소모하지 않는다. 소비 이력은 로그인 기간에 비례해 쌓이지 않는다. 전체 메모리는 현재 세션·최근 요청량·설정한 상한에 따라 달라진다.

로그인 IP 제한은 인증 전에 요청별 무작위 ID로 예약하여 동시 요청도 제한한다. 정상 비밀번호 인증에 성공하면 자신의 IP 예약만 반환하므로 공용 IP의 정상 로그인이 실패 횟수에 쌓이지 않는다. 기본 IP 예산은 실패·진행 중 요청 120회/분이며 다른 사람의 실패나 다음 시간 창의 요청을 성공 응답으로 지우지 않는다. 계정별 5회/15분 및 성공 시 계정 카운터 초기화는 유지한다.

HTML/RSC에는 요청마다 새로운 CSP nonce를 적용하고 운영 스크립트에 `unsafe-inline`·`unsafe-eval`을 허용하지 않는다. `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, 동일 Origin 통신/폼 제한을 적용한다. `next/image`의 위치/크기 스타일 속성은 허용하지만 스크립트 실행 정책과 분리한다. 개발의 React 디버깅/HMR 예외는 운영에 적용하지 않는다.

nonce는 PPR/정적 HTML 캐시에 재사용할 수 없으므로 Cache Components·Partial Prefetching을 끄고 HTML을 요청별로 렌더링한다. JS·CSS·이미지의 정적 캐시는 유지한다. ESLint는 `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, 문자열 코드 실행을 차단한다. 사용자 입력은 React 텍스트로 표시하며 HTML 입력 기능을 추가할 때는 별도의 검증·정화 경계가 필요하다.

이 설계는 HttpOnly BFF 세션용 요청 서명이며 표준 OAuth DPoP 구현으로 부르지 않는다. 추출 불가 키는 다른 브라우저로 복사한 쿠키만 사용하는 공격을 방어하지만 하드웨어 기기 인증은 아니다. 같은 Origin에서 XSS가 이미 실행되면 키로 서명을 대신 요청할 수 있으므로 CSP와 안전한 출력 코드를 함께 유지해야 한다.

## 배포 시 로그인 IP 전달

운영에서는 BFF 앞의 신뢰 프록시가 외부에서 온 헤더를 제거하고 실제 접속 IP 하나로 지정 헤더를 **덮어써야** 한다. 해당 프록시를 우회하여 BFF에 직접 접속할 수 없게 하고 `TRUSTED_CLIENT_IP_HEADER`를 지정한다. 단순히 클라이언트가 보낸 `X-Forwarded-For`의 첫 값을 신뢰하도록 설정하지 않는다. Spring API도 BFF를 통해서만 접근하도록 제한한다.

Spring에는 `AUTH_TRUSTED_PROXY_IPS`로 **Spring에 직접 연결하는 BFF 또는 프록시의 실제 IP**를 쉼표로 나열한다. 예를 들어 동일 호스트의 BFF만 신뢰한다면 `127.0.0.1,::1`로 지정한다. 호스트명·CIDR은 허용하지 않으며, 기본값은 신뢰 주소 없음이다. 동적으로 주소가 바뀌는 배포에서는 해당 설정도 함께 갱신한다.

Spring은 `server.forward-headers-strategy=none`으로 실제 연결 상대를 보존한다. 목록에 등록된 상대에게서 온 요청에만 `X-Real-IP` 하나를 허용하며, 이때 헤더 누락·중복·쉼표 목록·포트·IPv6 zone ID는 `400 INVALID_AUTHENTICATION_REQUEST`로 거부한다. 다른 상대의 전달 헤더는 무시한다. IP 리터럴은 DNS 조회 없이 해석·정규화하므로 같은 IPv6 주소의 표기 차이는 같은 로그인 제한 키를 사용한다.

신뢰 주소 설정은 방화벽·보안 그룹의 접근 제한과 함께 적용한다. BFF에서 Spring으로 가는 구간의 프록시도 외부 `X-Real-IP`를 그대로 전달하지 않도록 구성한다.

로컬 개발에서는 `TRUSTED_CLIENT_IP_HEADER`와 `AUTH_TRUSTED_PROXY_IPS`를 모두 비워 두므로 Spring은 BFF의 연결 IP를 기준으로 제한한다. 이 기본값은 직접 접속하는 local/dev용이며 운영에서는 양쪽 신뢰 프록시 구성이 필수다. Next는 헤더 이름 누락을, Spring은 신뢰 BFF 목록 누락을 시작 시 거절한다. 운영에서 등록되지 않은 BFF 주소나 필수 IP 헤더 누락은 사용자 IP로 대체하지 않고 요청을 거절한다. 프록시가 외부의 동일 이름 헤더를 제거·덮어쓰고 우회 접근도 차단해야 한다.

## 확인

```sh
npm run lint
npx tsc --noEmit
npm run build
```

UI 폰트는 `next/font/local`로 로드하는 Noto Sans KR을 사용한다.

## 홈 UI 기본 틀

홈은 상단 탐색·게임 검색·배너·카테고리·게임 카드·채팅 영역으로 구성한다. 공개 게임 목록은 `src/features/lobby/catalog.ts`에서 관리하며 현재는 오목 한 개만 표시한다. 검색과 카테고리는 함께 적용되고 결과가 없으면 전체 목록으로 돌아갈 수 있다.

계정 메뉴는 기존 브라우저 키·최신 세션 검증 결과로만 사용자 이름과 로그아웃을 제공한다. 비회원의 로그인 이동, 실제 입력에 따른 세션 연장, 세션 복구와 로그아웃 흐름은 유지한다. 인증 서비스 장애는 헤더에서 재시도를 안내하며 다른 공개 화면 요소의 배치를 밀어내지 않는다.

홈의 오목 카드는 실제 방 목록으로 연결한다. 상점·이벤트는 준비 안내를 제공한다. 게임 규칙·착수·승패 판정이나 실제 채팅 연결은 이 단계에 포함하지 않는다. 채팅 입력은 연결 전까지 비활성화하고 가상의 접속자 수나 사용자 대화는 표시하지 않는다. 모바일·태블릿에서는 채팅 버튼으로 대화상자를 열며 데스크톱에서는 오른쪽 패널로 표시한다. 홈은 최대 2,560px, 오목 화면은 최대 2,880px 안에서 콘텐츠 가독성을 유지한다.

배너는 기존 로그인 화면의 캐릭터를 참고해 내장 이미지 생성 도구로 제작한 `public/images/lobby/playground-banner.webp`를 사용한다. 생성 지시는 기존 캐릭터와 푸른 게임 도시를 유지하면서 왼쪽에는 제목을 놓을 여백을 만들고 오른쪽에는 캐릭터·오목돌을 배치하는 3:1 일러스트다. 제목·설명·버튼은 이미지와 분리된 HTML로 제공하고 `next/image`로 화면별 이미지 크기를 최적화한다. 오목 카드 표지는 추가 이미지 파일 없이 CSS 바둑판과 돌로 구성한다.

## 프로필 캐릭터

오른쪽 위 계정 메뉴의 **프로필 변경**에서 제공된 동물 캐릭터 10종 중 하나를 고른다. 선택 중에는 미리보기만 바뀌고 **저장하기** 성공 후 헤더에 적용한다. 취소·Escape는 선택을 저장하지 않는다. 기존 회원과 신규 가입의 기본값은 고양이(`CAT`)다. 닉네임은 현재 회원 정보에서 읽으며 이 화면에서는 수정하지 않는다.

`GET /api/auth/profile`과 `PUT /api/auth/profile`은 기존 BFF 쿠키·브라우저 서명·JWT·Redis 세션 검증과 탭 잠금·토큰 갱신을 공유한다. 변경에는 화면의 세션 ID를 결합해 이전 탭이 새 계정을 수정하지 못하게 한다. 응답은 캐시하지 않고 탭 복귀·계정 변경 알림에서 다시 조회한다. DB 프로필은 인증 세션과 분리하여 프로필 변경 때문에 Redis 세션을 다시 발급하거나 만료를 늘리지 않는다.

프로필 컬럼은 백엔드 Flyway의 `V1__initial_schema.sql`에 포함되어 서버 시작 시 관리한다. 기존 DB의 최초 전환은 [백엔드 Flyway 안내](../../back/playground/README.md#flyway-스키마-관리)를 따른다. 이미지 파일은 `public/images/avatars/`, 공개 목록과 검증은 `src/features/profile/catalog.ts`에 있다. [이미지 제작 지시와 파일 목록](docs/profile-avatars.md)을 함께 유지한다.

## 오목 1단계: 방 목록·생성

`/games/gomoku`와 `/games/gomoku/create`를 제공한다. 목록 상단은 검색창 → 전체 버튼 → 공개 방 버튼 → 대기 중인 방만 보기 토글 버튼 순서이며, 데스크톱에서는 한 줄로 표시한다. 모바일은 검색창 아래에 같은 버튼을 배치하고 방 표를 카드로 전환한다. 제목과 6자리 초대 코드로 검색하며 최신 생성순으로 6개씩 조회한다. 예시 방을 실제 화면에 삽입하지 않는다.

방 설정은 제목·공개 여부·비공개 비밀번호·무르기 1/3/5회·금수 규칙만 받는다. 생성 응답이 성공하면 초대 코드 확인·복사와 목록 이동을 제공한다. 계정당 열린 방은 하나이며 내 방 관리에서 본인의 빈 대기방을 닫고 새로 만들 수 있다. 중복 클릭과 시간 초과 재시도는 같은 요청 ID를 사용해 중복 생성을 막는다. 비밀번호는 저장소·URL에 남기지 않는다.

BFF 세 경로는 `POST /api/gomoku/rooms`, `POST /api/gomoku/rooms/search`, `POST /api/gomoku/rooms/close`다. 검색도 필터를 서명 본문에 결합하기 위해 POST를 사용한다. 기존 인증 잠금·세션 회전·브라우저 키·Origin 검증을 공유하고 결과를 화면의 세션 ID와 대조한다. 로그인 비밀번호와 마찬가지로 짧은 방 비밀번호는 증명 JWT의 빠른 본문 해시에서 제외하며 prod의 HTTPS·mTLS 정책과 local의 루프백 개발 예외를 따른다. dev HTTP에는 전송 기밀성이 없다.

빠른 매칭, 다른 방 입장, 초대 코드 입장, 대기실과 실제 대국은 다음 단계에서 연결한다. 해당 버튼은 준비 중 상태로 표시한다. 2명·20×20·30초는 고정 규칙이고 첫판 흑백 카드 뽑기, 이후 직전 패자 흑돌, 무승부 재추첨을 적용할 예정이다. 관전 기능은 제공하지 않는다.

공통 헤더는 `site-header.tsx`, 방 공개 계약은 `src/features/gomoku/contracts.ts`에서 관리한다. [오목 이미지 자산과 제작 지시](docs/gomoku-assets.md)를 함께 유지한다.
