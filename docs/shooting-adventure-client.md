# 슈팅게임 모험 모드 개선

작업일: 2026-11-04

후속 변경: 2026-11-05 전투 규칙은 버전 5로 바뀌었다. 아래 버전 4 설명은 당시 작업 기록이며, 현재 전투·기록 정책과 검증 범위는 [패턴 공략 전투 개선](shooting-combat-v5.md)을 따른다.

같은 날 사용자가 선택한 2번 다크 시네마틱 UI를 슈팅 전체 화면에 적용했다. 최신 화면 구조·반응형·브라우저 검증은 [다크 시네마틱 UI](shooting-dark-ui.md)를 따른다.

## 화면과 흐름

- `/games/shooting` 진입 시 모험 모드 / PVP 대전을 먼저 고른다. PVP는 기존 준비 중 안내를 유지한다.
- 모드·맵·협동 방 탐색·방 생성·캐릭터/무기 준비·전투·결과·재도전은 기존 런타임을 유지하며 하나의 게임 프레임 안에서 전환한다. 홈으로 나가기와 외부 초대 링크 소비는 별도로 유지한다.
- 맵 목록은 검색, 전체/도전 가능/클리어 필터, 한 페이지 6개, 첫/이전/번호/다음/마지막 페이지를 제공한다. 잠긴 맵의 전경과 지형도 미리 볼 수 있으며 출격 권한은 서버가 다시 확인한다.
- 일러스트 전경과 실제 충돌 지형은 구분한다. `지형 보기` 팝업은 전투 서버와 공유하는 `stageLayout`을 사용한다.
- 맵별 별 합계와 응답 검증은 맵 개수에 맞춰 계산한다. 3개 맵·9개 별·권한 마스크 7을 전제로 하던 검증을 제거했다.
- 헤더는 게임 이름과 소리·조작 안내·랭킹·홈을 유지한다. 조작 설명은 상단 버튼으로 여는 팝업에만 표시한다. 전투 중의 실제 스킬 버튼과 단축키 표시는 유지한다.
- 전투 상단은 10개 진행 노드, 현재 스테이지, 5·10스테이지 보스 표시를 제공한다. 체력·시간·남은 적·무기·스킬은 실제 서버 상태를 표시한다.
- 전투 캔버스는 32×32 SVG 조준 커서를 사용한다. 핫스폿은 `(16, 16)`이고 미지원 환경의 대체 커서는 `crosshair`다. 모달과 버튼은 일반 UI 포인터를 유지한다.
- 실제 헤더·푸터·본문 위치로 높이를 계산하는 `useArenaViewport`를 분리했다. FHD 이후 공통 반응형 크기 토큰을 사용하고 작은 창은 읽을 수 있는 최소 크기를 유지한 채 재배치·세로 스크롤한다.

## 실제 플레이 맵

모든 맵은 1인·2인 협동, 10스테이지, 5스테이지 수호자, 10스테이지 최종 보스, 별·랭킹·기록 저장을 공유한다.

| 순서 | 맵 | 3성 / 2성 기준 | 고유 전투 요소 |
| --- | --- | --- | --- |
| 1 | 수정 동굴 | 06:00 / 08:00 | 기존 수정·기둥 공략 유지 |
| 2 | 태엽 공장 | 06:40 / 09:00 | 기존 동력 장치 유지 |
| 3 | 덩굴 정원 | 07:20 / 10:00 | 기존 뿌리·꽃가루 유지 |
| 4 | 모래 유적 | 08:00 / 11:00 | 모래 토템 반경 145에서 이동 속도 75%, 파괴하면 둔화 해제·주변 적과 보스 약점 노출 |
| 5 | 얼음 협곡 | 08:40 / 12:00 | 빙결 핵 반경 165에서 이동 속도 55%, 파괴하면 둔화 해제·약점 노출 |
| 6 | 용암 성채 | 09:20 / 13:00 | 살아 있는 분출구가 전투 시간 4.8초마다 반경 155에 1.2초 예고 후 한 번 피해, 분출구 파괴 시 예약된 분출도 취소 |

1성은 완주 시 부여한다. 신규 맵은 덩굴 정원 → 모래 유적 → 얼음 협곡 → 용암 성채 순서로 열린다. 어느 한 플레이 방식에서 완주하면 다음 맵이 열리며, 협동 출격은 두 참가자 모두 해당 맵을 해금해야 한다.

둔화 계산은 공유 패키지의 `terrainSpeed`를 서버 이동과 클라이언트 입력 예측에서 함께 사용한다. 대시 거리는 유지한다. 지형·장치·적 배치는 매 스테이지마다 재설정되며, 일시정지·강화 선택 중에는 환경 기믹도 진행하지 않는다. 새 장치 종류는 기존 네트워크 장치 스키마를 재사용한다.

## 기록 호환과 적용

- 공유 전투 규칙과 Java 저장 규칙은 버전 4다. 기존 세 맵의 시간·전투 규칙은 유지했고 버전 3의 기록은 수정하지 않는다.
- 랭킹·최고 기록·해금 집계는 호환 버전 `[3, 4]`를 함께 조회한다. 신규 기록 제출은 버전 4만 받는다. SQL 버전은 서비스 규칙에서 매개변수로 전달한다.
- 신규 맵은 티켓·입장·방 목록·기록 저장의 허용 목록에 모두 반영했다. 브라우저에서 잠긴 맵을 선택하더라도 서버 출격 권한을 우회할 수 없다.
- 백엔드 `V38__expand_shooting_adventure_catalog.sql`은 이전 기본 게임 이름·소개만 갱신한다. 관리자 사용자 정의 문구와 과거 기록을 덮어쓰지 않는다.
- 적용 시 Spring MVC 백엔드와 `game/playground` 전투 서버를 함께 재시작해야 한다. 운영 중인 버전 3 전투를 마친 후 버전 4로 전환한다. 실행 중이던 사용자 개발 서버는 작업 중 종료하지 않았다.

## 실제 검증

### 코드·전투 검증

- 프론트 프로덕션 빌드 및 TypeScript 검사 통과.
- 슈팅 기능과 슈팅 페이지 ESLint 통과.
- 전투 서버 TypeScript 검사 통과.
- Java 컴파일과 임시 JUnit 교차 검증 통과. 공유 TypeScript 규칙에서 생성한 30개 시간 경계값, 맵 목록, Java 별 계산, 버전 4 DTO 검증이 일치했다.
- 실제 `GameSimulation`에 처치를 주입하는 검증으로 6개 맵 × 1인/2인 = 12개 완주 상태 전환, 10개 구간 기록, 5·10 보스 등장과 종료를 확인했다. 장시간 사람 플레이에 의한 밸런스 평가는 포함하지 않는다.
- 60개 스테이지의 월드 경계·시작 지점과 장치 120개의 벽 비중첩을 확인했다. 용암 맵의 중앙 벽이 분출구에 겹치지 않도록 수정했다.
- 신규 맵 세 장치의 실제 총알 충돌·파괴, 모래/빙결 둔화와 파괴 후 해제, 용암 예고·단일 피해·예약 취소를 확인했다.
- 검증용 TypeScript, JUnit, 임시 렌더링 페이지와 규칙 비교 데이터는 검증 후 삭제했다. 기존 테스트는 유지했다.

### 브라우저 UI 검증

Codex 내장 브라우저에서 임시 렌더링 페이지로 실제 게임 컴포넌트와 전투 렌더러를 확인했다. 브라우저 버전 정보는 도구에서 제공되지 않았다. 인증·서버 접속 정책을 바꾸지 않고 임시 데이터만 사용했다.

| CSS 뷰포트 | 확인 내용 |
| --- | --- |
| 1920×1080 | 모드 선택, 6개 맵 목록과 하단 시작 버튼, 전투 화면에 페이지 가로·세로 넘침 없음 |
| 2560×1440, 3840×2160 | 콘텐츠·카드·글자·게임 영역이 공통 상한 안에서 확장되고 가로 넘침 없음 |
| 1440×900, 1280×720, 1024×768 | 가로 넘침 없음, 맵 선택은 최소 크기를 유지하면서 필요한 세로 스크롤 허용 |
| 768×1024, 390×844, 320×568 | 맵 열 재배치와 상세 패널 접근 확인, 가로 넘침 없음 |
| 390×844 전투 | 진행 노드 10개가 프레임 안에 모두 표시되고 체력·시간·스킬 영역 접근 가능 |
| 844×390 | 좁고 낮은 창에서 가로 넘침 없음, 비터치 창의 필요한 세로 스크롤 허용 |

검색·잠긴 맵 상세·빈 필터 결과·지형 팝업·조작 안내 Escape 닫기·포커스 복귀를 확인했다. 임시 30개 맵 데이터로 마지막 페이지 `25–30 / 30`에서도 6개 카드만 렌더링하고 URL이 바뀌지 않는 것을 확인했다. 실제 카탈로그는 6개 맵이다.

신규 맵 세 종류의 전투 원화·지형·장치 표시와 캔버스 커서 URL·중앙 핫스폿을 확인했다. 용암 예고/피해 동작은 위 서버 검증으로 확인했다.

### 미검증 범위와 기존 빌드 경고

- 실제 로그인 세션으로 두 브라우저를 연결하는 온라인 협동, MySQL의 실제 저장·집계 및 Flyway 적용은 실행하지 않았다.
- 독립 Chrome·Edge·Firefox·Safari 및 실제 모바일 터치 기기는 미검증이다. 작은 뷰포트 확인이 실제 터치 기기 검증을 대체하지 않는다.
- 5120×2880을 요청했지만 내장 도구가 가로를 4096으로 제한했다. 확인된 실제 크기는 4096×2880이며 진짜 5K 검증으로 기록하지 않는다.
- 프로덕션 빌드는 성공했으나 기존 `auth/server/login-audit.ts`의 동적 파일 경로로 인한 Turbopack 추적 경고 6개가 남아 있다. 슈팅 변경과 무관한 기존 인증 코드는 수정하지 않았다.

## 원화와 생성 프롬프트

내장 `image_gen` 도구로 생성했으며 CLI/API 폴백은 사용하지 않았다. 프로젝트가 사용하는 최종 파일은 모두 저장소 내부에 복사했다.

| 최종 파일 (`front/playground` 기준) | 내용 |
| --- | --- |
| `public/images/shooting/stage-v3/desert.png` | 1536×1024, 투명 3×2 적·보스·모래 토템 아틀라스 |
| `public/images/shooting/stage-v3/ice.png` | 1536×1024, 투명 3×2 적·보스·빙결 핵 아틀라스 |
| `public/images/shooting/stage-v3/volcano.png` | 1536×1024, 투명 3×2 적·보스·분출구 아틀라스 |
| `public/images/shooting/stage-v3/map-covers.png` | 1536×1024, 3×2 맵 전경 아틀라스 |
| `public/images/shooting/aim-cursor.svg` | 기존 SVG UI 방식으로 작성한 32×32 조준 커서 |

적 원화 3종의 최종 프롬프트는 아래 템플릿과 치환값으로 구성된다. 참조 이미지는 기존 `stage-v3/cave.png`, `transparent_background=true`다.

```text
Use case: stylized-concept. Project game asset, sprite atlas. Use attached cave sprite sheet only as reference for matching cute chibi cartoon art style, thick dark outlines, front three-quarter angle, polished soft highlights. Generate a brand new sprite atlas for {description}. EXACTLY SIX isolated sprites, 3 columns by 2 rows, each sprite wholly contained centered in its equal square cell, very generous transparent padding, 1536x1024 layout if possible, no grid lines, NO TEXT, no labels, transparent background, no backdrop or floor. Order reading left to right top to bottom: 1 first small monster, 2 second shield monster, 3 ranged mage, 4 golem, 5 large boss, 6 device. All objects fit within central 75% of own cell. Keep truly transparent alpha outside sprites, no giant glow across cells, no shadows extending across cells. This is an actual browser shooting game sprite atlas replacing cave monsters with {name} themed monsters.
```

| name | description |
| --- | --- |
| desert | sandstone desert ruins; sandstone scarab charger, shielded golden beetle, floating sand mage shooting sand, bulky sandstone golem, large crowned scorpion king boss, a destructible golden sand hourglass totem |
| ice | icy blue glacial canyon; small frost wolf, shielded ice turtle, floating snow mage shooting ice, bulky ice golem, large crowned frost dragon boss, a destructible floating blue frost crystal core |
| volcano | orange-red volcanic fortress; small ember salamander, shielded obsidian beetle, floating flame imp shooting fire, bulky obsidian golem, large crowned lava beast boss, a destructible rocky orange lava vent |

전경 원화의 최종 프롬프트는 다음과 같다. 참조 이미지는 기존 `stage-v3/stage-cover.png`, `transparent_background=false`다.

```text
Use case: stylized-concept. Asset type: six map background thumbnail atlas for an actual game UI. Produce ONE 1536x1024 landscape image composed of EXACTLY 3 equal columns and 2 equal rows, six square illustrations, no gaps, no labels, no frames, no characters or monsters, no text. Reference is only for art style: cute polished colorful fantasy cartoon environments, thick rounded shapes and soft light. Each scene entirely confined to its square cell and composition centered so it can be center cropped to 16:9. Reading order: TOP LEFT a glowing violet crystal cavern with purple rock pillars and turquoise opening; TOP MIDDLE a warm amber steampunk clockwork factory with pipes and large cogwheels; TOP RIGHT a bright lush overgrown garden with vines and a stone arch; BOTTOM LEFT sunny golden desert ruins with sandstone pillars and pyramids; BOTTOM MIDDLE blue icy glacial canyon with crystalline ice cliffs; BOTTOM RIGHT a dark purple volcanic fortress with orange lava rivers and glowing fortress towers. The six maps must be visually distinct and closely match the polished landscapes in a friendly Korean chibi shooting game UI. No chrome or interface included, only the precisely aligned six equal square environment cells.
```

구현 전 Next.js 16.4.2의 설치된 Server/Client Components 문서와 프로젝트 반응형 지침을 확인했다. 커서는 [Phaser Input 공식 문서](https://phaser.io/oss/docs/phaser/concepts/input)와 [MDN cursor 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor)의 커서 URL·핫스폿 방식을 따랐다.
