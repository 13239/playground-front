# 같은 그림 찾기

## 2026-10-29 캐릭터형 창·접속 오류·카드 가림

- 사용자가 선택한 캐릭터형으로 플레이 선택(A), 방 만들기(B), 나가기(B)를 적용했다. `MemoryDialog`는 공통 native dialog의 제목 연결·Escape·포커스 복귀·처리 중 닫기 제한을 재사용한다. 닫기 버튼에 별도 여백과 44px 조작 영역을 두고, 비공개 스위치·입력·하단 동작에도 최소 크기를 적용한다. 비밀번호가 필요한 경우만 입력란을 표시하며 기존 공개/비공개·참여코드·친구 초대 정책을 유지한다.
- 배너 안에 `홈 → 게임 → 같은 그림 찾기` 경로를 추가하고 배너 밖 게임 목록 버튼을 제거했다. 하단 목록과 푸터 사이의 기존 1rem 간격은 유지한다.
- Web Locks의 즉시 실패(`ifAvailable`)를 취소 가능한 대기로 바꿨다. Strict Mode의 effect 재실행이나 같은 탭의 재연결 때 이전 잠금 해제를 기다린다. 잠금을 얻기 전에는 상태/SSE/접속 갱신 요청을 보내지 않으며, 실제 두 번째 탭은 대기 안내를 표시한다. 취소한 대기·타이머·SSE를 정리하고 기존 탭 종료 시 다음 탭이 잠금을 얻는다. 서버의 계정/탭 소유권 검증은 유지한다.
- `useMemoryPrivacy`는 활성 경기에서 창 포커스 상실·탭 숨김, 전달된 PrintScreen·Win+Shift+S·macOS 캡처 단축키, 인쇄 이벤트에 반응한다. 같은 이벤트에서 CSS 가림을 먼저 적용하고 React에서도 카드 그림·이름을 제거하고 선택을 막는다. 캡처 단축키가 전달된 경우 명시적인 카드 다시 보기로 복구하며, 일반 창 복귀는 포커스 확인 후 복구한다. 판 영역의 우클릭·복사·드래그를 막고 인쇄 CSS에서도 판을 숨긴다. 다른 입력이나 사이트 전체 단축키를 차단하지 않는다.
- 가림·창 전환은 최초 3초 공개·게임 시간·오답 1초·2인 차례 제한을 멈추거나 다시 시작하지 않는다. 가림 신호만으로 부정행위 판정·패배·기록 삭제를 하지 않는다. OS가 이벤트를 전달하지 않는 캡처, 먼저 저장한 화면, 외부 녹화·촬영은 감지/차단을 보장하지 않는다.
- 새로 정리한 15종 이미지는 `public/images/memory/characters-spaced.png`(1619×971)다. 내장 `image_gen`을 사용했으며 원본 선택 캐릭터와 순서를 유지했다. 각 캐릭터의 실제 중심과 280px 정사각 표시 영역을 `Character`에 지정해 기존 불균등 칸 경계에서 발생하던 옆 캐릭터 노출을 막는다. 캐릭터 15종과 양쪽 쌍을 시각적으로 확인한다. 판은 한 경기의 열·위치를 고정하고 좁은 창에서는 44px 조작 크기를 유지하며 필요한 가로 스크롤을 판 안에 한정한다.

아틀라스 최종 프롬프트(내장 image_gen):

```text
Use case: compositing. Create a NEW PRODUCTION SPRITE ATLAS based ONLY on the character identities in the reference, NOT the reference layout. CRITICAL CHANGE: all characters must be MUCH SMALLER than in reference so there is a LARGE EMPTY TRANSPARENT GUTTER separating every character. Uniform five columns by three rows. Each cell must have an EMPTY TRANSPARENT BORDER at least 20% of its width and height all around; each animal occupies ONLY the middle 60% of its own cell. Perfectly equal spacing and alignment is mandatory. Visually this sheet should look sparse with lots of transparent blank space. Canvas landscape ratio 5:3. 15 characters only, exact order: row1 ivory floppy bunny, orange fox, gold bear, lavender kitten, green frog; row2 blue penguin, yellow chick, coral octopus, cyan whale, green turtle; row3 blue elephant, purple baby dragon with mint wings, white ghost, orange squirrel, brown owl. Preserve the original cute 3D toy identity, colors and full bodies. Elephant ears and dragon wings and every tail entirely within the CENTRAL 60% of each cell. Make ALL characters visibly smaller, do not keep the reference scale. NO overlapping, NO cropped characters, NO touching cell boundaries, NO edge noise. Background genuinely transparent. No lines, no text, no props, no card frames. This will be cut by code into fifteen exactly equal cells; wrong spacing breaks the game. Priority: strict uniform cell centers and generous completely transparent margins.
```

검증 결과:

- 최종 Next.js 배포 빌드·TypeScript·memory 기능 전체 ESLint를 통과했다. 개발 모드(Strict Mode 포함)와 최종 배포 빌드에서 같은 브라우저 검증을 실행했다.
- Chrome 156.0.8078.48·Edge 156.0.4314.50, 배율 100%에서 1920×1080·1920×920·2560×1440·3840×2160·5120×2880·1366×768·1101×700·1024×768·768×1024·390×844·320×740·844×390·390×420의 13개 뷰포트를 사용했다. 세 모달의 78개 배치 조건에서 페이지 가로 넘침·팝업 경계 잘림·닫기/제목 겹침이 없었다. 작은 높이에서는 모달 내부 스크롤을 허용한다. FHD 로비 문서 높이는 1080px, 목록 하단과 푸터 사이는 16px이다.
- 모의 인증/API와 격리한 브라우저 키로 실제 화면을 실행했다. 방 생성/참가/새로고침의 탭 식별 유지, 비공개 코드→비밀번호 참가, 폼 검증, 처리 중 Escape 차단, 같은 탭 재연결, 실제 두 번째 페이지의 대기/대기 취소/기존 잠금 해제 후 인계, 1인/2인 기권 안내를 확인했다.
- 15종이 각 두 장씩 표시되는 것을 확인하고 시각 검토했다. 창 포커스 상실과 visibilitychange 신호에서 그림·접근 가능한 카드 이름 제거, inert·선택 제한, 공개 마감이 가림 중 지나면 복구해도 다시 공개되지 않음, 캡처 키 후 수동 복구, 인쇄 이벤트/인쇄 CSS, 판의 우클릭 제한을 확인했다. 모바일 새 판 5열과 13단계 크기 변경 후 위치 유지·44px 이상 카드·페이지 가로 넘침 방지도 확인했다.
- 기능 결과 24개 항목 중 실제 실행 가능한 22건을 확인했고 두 브라우저의 실제 OS 포커스 전환은 헤드리스 환경에서 미검증으로 기록했다. 키 입력·합성 blur/visibility 신호·인쇄 미디어 검증을 실제 OS 캡처 도구 차단 검증으로 해석하지 않는다. Firefox·Safari·실제 모바일 키보드·실제 계정/백엔드 연결도 미검증이다. OS 캡처 방지를 보장하지 않는다.
- 임시 검증 소스는 삭제하고 최종 캡처와 상세 결과를 프로젝트 루트 `artifacts/memory/dialogs-privacy/`에 저장했다. 실제 UI 캡처는 모의 사용자/데이터를 사용한다. 캐릭터 이미지 정리는 내장 `image_gen`으로 수행했으며 최종 자산 경로와 최종 프롬프트는 위에 기록했다.

## 2026-10-29 로비 목록 높이

- 데스크톱(가로 1101px 이상·높이 700px 이상)은 공통 헤더·푸터를 제외한 실제 본문 여유 높이를 두 패널이 채운다. 인증 래퍼까지 flex 높이를 연결하며 패널 하단과 푸터 간격은 1rem이다. FHD 기본 글꼴에서는 16px이다.
- 모바일·작은 창은 기존 콘텐츠 높이와 필요한 스크롤을 유지한다. 목록 내용이 많으면 잘라내거나 글자를 축소하지 않고 본문을 자연스럽게 늘린다. 게임 플레이 화면에는 적용하지 않는다.
- 배포 빌드와 TypeScript를 통과했다. Chrome 156.0.8078.48·Edge 156.0.4314.50, 배율 100%, 1920×1080·1920×920·2560×1440·3840×2160·5120×2880·1366×768·1024×768·768×1024·390×844·320×740·844×390, 그리고 데이터 10건이 있는 FHD·모바일을 합쳐 총 26개 조건을 검증했다.
- FHD 빈 목록 기준 두 패널 하단은 y=1017.39px, 푸터 상단은 y=1033.39px로 간격 16px이며 문서 높이는 1080px이다. 확인한 모든 조건에서 가로 넘침이 없었다. 모의 인증/API로 검증했으며 Firefox·Safari는 미검증이다. 임시 검증 소스는 삭제하고 캡처·결과는 `artifacts/memory/height/`에 남겼다.

## 2026-10-29 A안 로비·3번 캐릭터형 참여코드 팝업

- 선택한 A안에 맞춰 가로형 소개·캐릭터 카드, 하단 2인 대기방/1인 랭킹의 두 패널로 정리했다. 데이터가 없으면 안내 그림과 문구를 표시하고 빈 표·페이지 탐색은 표시하지 않는다. 데이터가 있으면 기존 번호 페이지네이션을 유지한다.
- 대기방의 인라인 입력을 `참여코드로 참가` 버튼으로 바꿨다. 선택한 3번 팝업은 여우 안내 이미지, 제목, 단일 코드 입력, 전체 폭 참가 버튼, 취소로 구성한다.
- 공통 `RoomDialog`의 선택적 `illustration`만 확장해 기존 모달의 제목 연결·Escape·전송 중 닫기 방지를 재사용한다. 기존 오목·방 생성 팝업은 이미지가 없는 기존 구조를 유지한다.
- 입력 시 포커스를 코드로 이동하고 영문은 대문자로 정규화한다. 여섯 자리 입력 후에만 참가할 수 있고 Enter와 붙여넣기를 지원한다. 공백·하이픈을 포함한 붙여넣기도 영문·숫자 여섯 자리로 정규화한다. 취소·닫기·Escape 후 호출 버튼으로 포커스가 돌아간다.
- 아이콘과 입력을 `data-focus-frame`으로 묶어 공통 1px 포커스 테두리를 사용한다. 잘못된 코드 안내, 수정 후 오류 해제, 전송 중 중복 제출 차단, 비공개방의 기존 비밀번호 확인 흐름을 유지한다.
- Next.js 배포 빌드·TypeScript·변경 파일 ESLint를 통과했다. Chrome 156.0.8078.48 / Edge 156.0.4314.50에서 배율 100%, 1920×1080·2560×1440·3840×2160·5120×2880·1366×768·1024×768·768×1024·390×844·320×740·844×390·390×420, 총 22개 화면 조건을 확인했다. 페이지 가로 넘침과 팝업 경계 잘림이 없고, FHD는 문서 스크롤 없이 표시됐다. 짧은 화면에서 필요한 모달 내부 스크롤은 허용한다.
- 실제 UI와 모의 인증/API로 정규화·붙여넣기·6자리 제한·Enter·오류 수정·전송 중 Escape/중복 요청 차단·닫기/취소·비공개 비밀번호 전환·페이지 이동·기존 모달을 검증했다. Firefox·Safari·실제 기기 키보드·실제 계정 연결은 미검증이다. 임시 검증 소스는 삭제하고 결과와 캡처는 `artifacts/memory/ui-a/`에 남겼다.
- 새 자산 `public/images/memory/join-fox.png`는 내장 `image_gen`으로 제작한 투명 PNG다. 입력 팝업 비교 시안과 기존 캐릭터 아틀라스를 참고했고, UI는 이미지가 아닌 실제 컴포넌트로 구현했다.

여우 이미지 최종 프롬프트:

```text
Use case: stylized-concept. Asset type: transparent reusable mascot illustration for a room-code entry dialog. Reference image 1 is UI DESIGN REFERENCE ONLY: recreate ONLY the small orange fox peeking over a lilac ticket in the RIGHTMOST third modal. Do not include any UI, modal frame, buttons, background, or text. Reference image 2 is CHARACTER IDENTITY reference: preserve its selected orange fox (first row, second column), with white muzzle and chest, triangular ears, large fluffy tail and tiny dark brown paws, same soft premium 3D clay toy material and friendly face. Create ONE centered isolated fox upper body peeking over and holding a large horizontal pale-lilac admission ticket with its two paws resting on the top edge. Ticket has rounded scalloped sides and a simple purple outline illustration of two overlapping admission tickets in the center, with NO writing, letters or numbers. A couple of very small warm yellow star sparkles left and right. Original character identity, cohesive pastel lilac and orange palette. Entire fox ears, ticket and sparkles fully inside frame, generous transparent margins, no cropped parts, no ground shadow, genuine transparent alpha background. Frontal view, clean silhouette readable at 150px wide, polished cute but simple, square image.
```

## 확정 규칙

- 선택된 캐릭터는 원본 시안 1·2·3·5·7·8·9·13·14·16·19·22·23·26·27이다. 토끼·여우·곰·고양이·개구리·펭귄·병아리·문어·고래·거북이·코끼리·아기 용·유령·다람쥐·부엉이 순서로 0~14를 사용한다.
- 카드 30장, 15쌍 고정. 매 판 배치를 새로 섞는다.
- 시작 시 전체 카드를 한 번만 3초 공개한다. 서버의 같은 시작 시각을 유지하므로 새로고침으로 미리보기를 다시 시작할 수 없다.
- 1인은 공개 종료부터 마지막 정답의 서버 확정까지 측정한다. 정답을 클라이언트가 제출하거나 클라이언트 경과 시간을 신뢰하지 않는다.
- 1인 랭킹만 제공한다. 사용자별 최고 시간, 같은 시간이면 적은 시도 횟수를 사용하며 두 값이 모두 같으면 공동 순위다. 번호 페이지와 내 최고 기록·순위를 제공한다.
- 2인은 단판이며 정답 한 쌍당 1점이다. 정답이면 같은 차례를 10초로 초기화한다. 오답은 두 사람에게 1초 공개한 뒤 덮고 상대의 10초 차례를 시작한다. 시간 초과는 선택 중인 카드도 덮고 차례를 넘긴다.
- 15쌍 모두 찾으면 점수가 높은 참가자가 이긴다. 승·패만 저장하고 무승부는 없다. 서버 중단 등 무효 경기는 전적에 포함하지 않는다.
- 첫 선공은 무작위, 같은 두 사람의 재대결은 선공을 교대한다. 재대결은 두 사람의 동의가 필요하며 새 판에서 다시 3초 공개한다.
- 종료 화면과 판 아래에 재대결·나가기를 제공한다. 1인은 종료 기록과 나가기를 제공한다.
- 효과음 켜기·끄기를 제공한다. 최근 기록·연습 모드·힌트·일시정지·일일 도전·업적·최고 기록 갱신 알림은 추가하지 않는다.

## 화면과 참가

`/games/memory`에서 랭킹, 대기방, 참여코드를 확인하고 게임 시작에서 1인 또는 2인 방 생성을 고른다. 2인 방은 공개·비공개를 지원한다. 비공개방은 일반 입장에서 비밀번호가 필요하며 본인에게 발급된 유효한 친구 초대를 수락한 경우만 비밀번호 대신 초대 권한을 사용한다.

온라인 친구 초대는 기존 전역 소셜 알림과 친구 검색·번호 페이지를 사용한다. 수락·거절·취소를 제공하며 초대 기한은 15초다. 만료된 초대는 즉시 숨기고 서버에서도 수락을 거절한다. 초대 상태와 기한은 MySQL에 보존한다. 만료된 `PENDING` 원본은 조회 조건에서 제외되며 다음 응답에서 `EXPIRED`로 확정된다.

PC 기본 6×5, 모바일 세로 기본 5×6이며 플레이 중 열 수는 유지한다. 창을 변경할 때 카드의 위치가 바뀌면 기억 정보가 달라지기 때문이다. 실제 콘텐츠 영역과 공통 rem·페이지 폭 상한 안에서 카드 크기를 조절하며 작은 높이에서는 문서 스크롤을 허용한다.

## 서버와 보안

- `domain/memory`는 오목 엔티티와 분리하고 공통 카탈로그·인증·친구 정책·Redis 세션을 재사용한다. 채팅 서버의 소셜 변경 전파는 기존 기능을 사용한다.
- 기존 Origin·BFF·JWT·브라우저 증명 안에서 POST 명령과 SSE 변경 신호를 처리한다. 방 생성·입장의 비밀번호는 브라우저와 BFF 양쪽에서 빠른 서명 해시에서 제외한다.
- 방 잠금 아래 현재 참가자·탭·판 식별자·revision을 확인한다. Web Lock은 복제 탭의 동시 조작을 제한하고 응답의 세션 ID와 revision은 이전 계정·판의 응답을 차단한다.
- 최초 공개 후 응답은 현재 공개된 카드와 이미 맞춘 카드만 포함한다. 정답 배치·내부 회원 번호·비밀번호 해시·로그인 식별자를 공개 DTO로 직렬화하지 않는다. 최초 3초에 정상 공개한 정보의 캡처나 외부 기억 보조 수단을 완전히 차단하는 기능은 아니다.
- 승패·최고 기록은 종료 트랜잭션과 함께 한 번만 반영한다. 네트워크 재시도·타이머 중복·지난 판의 나가기 요청이 새 판의 전적을 변경하지 않는다.
- 서버 시계는 활성 방의 다음 마감만 메모리에 유지하고 Redis로 공유한다. 빈 게임 테이블을 매초 조회하지 않으며 재시작·Redis 재구독 때 예약을 복구한다. 늦은 예약이 더 이른 게임 마감을 덮어쓰지 않는다.
- 접속은 5초마다 확인한다. 2인 단절은 60초 유예하며, 양쪽 단절·서버 장기 중단은 무효 처리한다. 명시적 기권·나가기·SPA 이동은 패배이며 새로고침은 접속 유예 안에서 복구한다.

## 적용

백엔드 시작 시 새 Flyway `V32__create_memory_game.sql`이 게임과 두 모드, 방·최고 기록/승패·초대 테이블을 등록한다. 기존 마이그레이션을 변경하지 않는다. 프론트와 MVC 백엔드를 함께 반영한다. 실제 사용자 DB·운영 배포에는 아직 적용하지 않았다.

## 이미지 제작

내장 `image_gen`을 사용했다. 현재 최종 자산은 `public/images/memory/characters-spaced.png`이며 투명 배경의 5×3 아틀라스다. 각 캐릭터의 실제 중심과 280px 정사각 표시 영역을 CSS 배경 위치로 참조한다. 잘림이 발생했던 초기 아틀라스는 코드 참조가 없음을 확인한 뒤 삭제했다. 원본 후보 시트는 스타일·정체성 보존을 위한 참조 이미지로만 사용했다.

초기 이미지 생성 프롬프트(현재 자산의 최종 정리 프롬프트는 위 2026-10-29 항목에 기록):

```text
Use case: identity-preserve. Create the final GAME SPRITE ATLAS from the reference character selection sheet. Preserve the exact visual identity, colors, expression and soft 3D clay style of the chosen characters. Select ONLY original numbers 01,02,03,05,07,08,09,13,14,16,19,22,23,26,27. Rearrange them into EXACTLY FIVE COLUMNS and THREE ROWS of identical-size SQUARE cells. Overall image aspect ratio MUST be 5:3. Row 1: original 01 ivory floppy bunny, 02 orange fox, 03 golden bear, 05 lilac cat, 07 green frog. Row 2: original 08 blue penguin, 09 yellow chick, 13 coral octopus, 14 turquoise whale, 16 green turtle. Row 3: original 19 blue elephant, 22 purple mint-winged dragon, 23 white friendly ghost, 26 orange squirrel, 27 cream-and-brown owl. Remove ALL numbering, text, labels, shadows on background and unselected characters. Genuine transparent alpha background. Invisible equal square grid boundaries: center each full character strictly in its cell, keep ALL ears, feet, wings and tails within the central 84 percent of the cell. Same apparent visual size and consistent baseline. No drawing may cross a cell edge. No outlines of cells, no decorations, no UI. These precise grid cells will be used as CSS sprites in a memory card game. Exactly 15 characters, not 30. High quality, crisp, polished, original chosen identities.
```

## 검증 결과

- Java 25 서버 컴파일, Next.js 16.4.2 프로덕션 빌드·TypeScript·변경 파일 ESLint를 통과했다.
- 서버 임시 검증 25개: 카드 쌍 구성, 정확한 3초/1초 경계, 동일 카드 재선택 거절, 정답 시 10초 초기화, 시간 초과·늦은 시계 처리, 15쌍 종료, 선공 교대, Redis 예약 순서, 유휴 DB 조회 방지, V1~V32 전체 마이그레이션·Hibernate 스키마 검증, 실제 MySQL 저장·최고 기록·동점 처리, 중복 시작·종료 집계, 타인/다른 탭 보호, 동시 입장, 비공개 코드 입장, 친구 초대·15초 만료, 재대결 초기화, 지난 판 종료 차단을 확인했다.
- 인증·BFF 임시 검증 18개: local 모드의 비밀번호 제외 서명 해시 일치, 공개 응답에서 정답/비밀번호/로그인 식별자 제거, 세션 결합, 추가 입력·범위를 벗어난 카드·잘못된 경로·잘못된 백엔드 응답 거절을 확인했다.
- Chrome 156.0.8078.48·Edge 156.0.4314.50에서 브라우저 배율 100%, CSS 뷰포트 320×740, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080, 2560×1440, 3840×2160, 5120×2880, 844×390을 확인했다. 각각 모바일 최초 진입 390×844도 별도로 검증해 총 22개 조건에서 카드 겹침과 페이지 가로 넘침이 없었다. 창 크기 변경 중 카드 열 수가 유지되고 고해상도에서 카드가 상한 안에서 커지는 것을 확인했다.
- 실제 화면·컴포넌트에서 3초 최초 공개, 오답 1초 후 덮기, 정답 유지, 1인 완주·목록 복귀, 효과음 전환, 2인 재대결 대기, 모바일 최초 5×6, 새로고침 후 미리보기 재시작 방지를 확인했다. 모바일의 필요한 세로 스크롤은 허용한다.
- DB 검증은 별도로 만든 임시 MySQL에서 수행했다. 인증·친구 관계·알림·게임 이용 정책은 서버 테스트에서 모의 객체를 사용했다. 브라우저 검증도 모의 인증·API를 사용했다. 실제 두 계정과 모든 서버를 함께 연결한 종단 검증, Firefox·Safari·실제 모바일 기기 검증은 수행하지 않았다.
- 이번에 작성한 임시 테스트 소스와 검증 서버·임시 DB는 검증 후 제거하며, 기존 테스트와 사용자 DB는 유지한다. 결과 JSON과 화면 캡처는 작업 공간의 `artifacts/memory/`에 남긴다.
