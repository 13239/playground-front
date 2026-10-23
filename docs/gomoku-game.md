# 오목 대국

## 동작

- 기존 `/games/gomoku/rooms/[roomId]`에서 대기실 → 제비뽑기 → 대국 → 결과 → 재대국으로 이어진다.
- 두 명 모두 준비하면 서버가 흑돌 카드를 무작위로 정한다. 각자 뒤집힌 카드 한 장을 선택하고 두 선택이 끝나면 동시에 공개한다. 20초 동안 선택하지 않은 카드는 서버가 배정한다. 공개 3초 후 흑부터 시작한다.
- 같은 참가자 두 명이 재대국하면 직전 패자가 흑이다. 무승부나 참가자 교체 후에는 다시 제비뽑기한다.
- 판은 20×20, 한 수는 30초다. 마감 시각에 도달하면 착수 없이 상대 턴으로 넘어간다. 클라이언트가 보낸 시각이나 승패는 사용하지 않는다.
- 자유 룰은 흑백 모두 5개 이상 연결하면 승리한다. 금수 적용 시 흑은 정확한 5목으로 승리하며 3·3, 4·4, 장목 착수는 거부한다. 백은 5개 이상으로 승리한다. 열린 3·가짜 3·중복 4의 판정은 [RIF 9.1~9.3](https://gomoku.renju.net/rifrules/) 정의를 따른다. RIF의 15줄 판·중앙 첫 수·대회 오프닝 규칙은 이 사이트의 20줄·제비뽑기 규칙과 별개다.
- 무르기는 상대 수락 전까지 판을 바꾸지 않는다. 수락하면 요청자의 마지막 착수부터 이후 돌까지 제거하고 요청자 차례, 새 30초로 복원한다. 각자 방 설정의 1/3/5회를 가지며 수락된 요청만 차감한다. 거절·10초 응답 만료·다음 착수·턴 패스는 요청을 취소하며 횟수는 차감하지 않는다. 응답 중에도 턴 시간은 흐른다.
- 판이 모두 차면 무승부, 기권 또는 대국 중 명시적 나가기는 패배다. 두 사람의 재대국 요청이 모두 있어야 다음 판을 만든다.
- 빠른 매칭 버튼은 기존 범위를 유지한다. AI 대전은 방을 만들지 않는 독립 로컬 대국이며 [AI 대전](gomoku-ai.md)에 규칙과 탐색 설정을 정리한다.
- 초대 코드 입력은 대소문자를 대문자로 맞춘 영문·숫자 6자리를 사용하며 0·1·I·O도 허용한다. 화면·BFF·MVC 입장 검증과 코드 검색이 같은 범위를 사용한다. 공개방의 코드가 일치하면 확인창 없이 바로 입장하고, 없는 방이나 닫힌 방에는 화면 상단 중앙에 `방을 찾을 수 없습니다.` 한 문장만 있는 사이트 테마 토스트를 표시한다. 토스트는 확인 버튼·배경 가림·포커스 이동 없이 약 2초 뒤 자동으로 사라지며, 표시 중에도 코드 수정과 재입장을 할 수 있다. 비공개방은 서버가 요구하는 비밀번호를 확인한 뒤 입장하며 비밀번호 검증을 우회하지 않는다.

## 연결과 동기화

`POST /api/gomoku/rooms/game`은 카드 선택, 착수, 무르기 요청/응답, 기권, 연결 종료, 재대국을 처리한다. 요청은 `roomId`, `matchId`, `revision`, UUID `requestId`, `action` 및 해당 동작에 필요한 값만 보낸다. 방 행 잠금과 최신 대국·참가 검증으로 동시 착수와 지난 판의 명령을 막는다. 같은 직전 요청의 재전송은 한 번만 적용한다.

`POST /api/gomoku/rooms/game/events`는 기존 Origin·BFF 쿠키·JWT·브라우저 증명을 검증한 짧은 SSE 연결이다. 데이터 대신 변경 알림만 보내고 판은 기존 `state` API로 다시 조회한다. 연결은 20초 후 정상 만료되어 새 인증으로 갱신한다. 5초 주기 조회가 참가 접속, 채팅 리스, 누락된 알림을 복구한다. Redis Pub/Sub으로 다른 MVC 인스턴스에도 커밋된 변경 알림을 전달한다. BFF의 SSE 연결 풀은 일반 인증·착수 연결 풀과 분리한다. 프록시는 이 경로의 버퍼링을 끄고 스트림 취소를 상위 연결에 전달해야 한다.

첫 데이터 연결 실패 후 재접속은 최대 5회이며 대기 간격은 1·2·4·8·10초, 상태 요청 제한 시간은 5초다. 정상적인 SSE 만료나 로그인 만료는 게임 재접속 실패로 세지 않는다. 복구 성공 시 실패 예산을 초기화한다. 5회 소진 후에는 새 착수를 막고 결과 확인에서 본인의 연결 종료를 확정한다.

실패한 네트워크 요청과 닫힌 브라우저는 서버에 실패 횟수를 보고할 수 없으므로 서버는 별도의 접속 마감도 사용한다. 마지막 접속 확인 후 15초가 지나면 재접속 대기로 표시하고 150초 동안 복구하지 못하면 패배시킨다. 이 기간에도 턴 시간은 흐른다. 양쪽 동시 단절이나 긴 서버 중단은 특정 사용자의 패배로 만들지 않고 중단 무승부로 처리한다. 승패는 항상 서버 응답으로 표시한다.

대국 시계는 활성 판의 다음 마감만 메모리에 보관한다. 1초 주기는 메모리의 예약만 확인하며 마감에 도달한 방만 DB에서 읽는다. 대국이 없으면 주기적인 대국 DB 조회도 없다. 시작·접속 갱신·착수·종료의 예약 변경은 SQL 커밋 뒤 로컬 서버와 Redis 구독 서버에 반영한다. 지연된 알림은 마감을 늦추거나 새 판의 예약을 취소하지 못한다. 서버 시작과 Redis 재구독 때만 미종료 판을 배치 조회해 예약을 복구한다. 기존 대기실 만료 정리(30초 주기)는 별도로 유지한다.

## 화면 이동과 브라우저 종료

대기실·대국의 뒤로가기와 앱 내부의 다른 화면 이동은 퇴장으로 처리한다. 대국 중 퇴장은 기권 패배를 기록한 뒤 참가자를 삭제하고, 방장을 위임하거나 마지막 참가자가 나간 방을 닫는다. 이미 끝난 대국의 결과는 퇴장으로 덮어쓰지 않는다. 브라우저 앞으로가기나 BFCache로 퇴장한 화면을 복원하면 방 목록으로 이동한다.

새로고침은 참가를 유지한다. Navigation API를 지원하는 브라우저는 `reload`를 구분해 종료 알림을 보내지 않는다. 그 외의 문서 종료는 5초의 유예를 둔다. 새 문서의 `OPEN`이 새 페이지 식별자로 참가를 이어받으면 종료 예약을 취소한다. 따라서 새로고침을 직접 구분하지 못하는 브라우저에서는 5초 안에 새 문서의 접속 확인이 완료되어야 한다. 이전 페이지의 늦은 `CLOSE`와 이전 참가 식별자의 퇴장은 새 문서·재입장 참가를 삭제하지 못한다.

페이지 종료 요청은 살아 있는 동안 기존 브라우저 키·nonce로 미리 서명하고 `fetch`의 `keepalive`로 전송한다. `/api/gomoku/rooms/lifecycle`도 일반 API와 같은 Origin·BFF·JWT·Redis 세션·브라우저 증명을 검증한다. 쿠키만으로 퇴장시키는 공개 경로나 장기 토큰은 추가하지 않는다. 미리 만든 요청은 메모리에만 보관하고 실제 전송 시에도 기존 인증이 유효해야 한다. 새 화면의 `OPEN`은 문서마다 한 번만 보내며 서명 준비 갱신으로 방 상태의 DB 폴링을 추가하지 않는다.

Flyway V7은 참가 행의 `page_id`, `exit_deadline`과 인덱스를 추가한다. 종료 마감은 기존 메모리 시계·Redis 예약 알림을 공유하고 서버 시작·Redis 재구독 때 복구하므로 새 전역 DB 폴링이 없다. 브라우저 강제 종료·네트워크 단절처럼 종료 요청 자체를 보내지 못한 경우는 서버 접속 만료로 보완한다. 대국의 기존 5회 재접속·150초 서버 판정은 유지하고, 대기 중 90초·대국 중 180초 이상 확인되지 않은 참가자는 기존 30초 정리 주기에서 제거해 방에 영구히 남지 않게 한다.

Flyway V10은 페이지 점유에 내부 `login_session_id`를 추가한다. 시크릿 창 종료 등으로 종료 알림이 유실된 뒤 다시 로그인하면, 서버가 방 잠금 안에서 새 로그인 유효성과 이전 로그인 만료를 Redis로 확인하고 같은 참가·좌석을 새 페이지로 인계한다. 같은 로그인에서 다른 활성 탭을 여는 경우는 계속 거절한다. 기존 참가 행은 마지막 접속 이후 생성된 로그인만 즉시 복구할 수 있으며, 나머지는 기존 탭 점유 만료 규칙을 따른다. 이전 페이지의 늦은 종료 알림은 새 페이지를 퇴장시키지 못한다. 이 검증은 `OPEN`에만 추가되며 주기 조회의 Redis 호출은 늘리지 않는다. 점유 거절 화면의 `다시 연결`은 새 페이지 식별자로 잠금과 서버 검증을 다시 수행한다. 적용하려면 MVC 서버를 재시작해 V10을 실행하고 프론트 변경도 함께 반영한다.

## 데스크톱 팝업 모드

- 데스크톱에서 대국 중 `팝업 모드` 버튼을 표시한다. 모바일·태블릿 UA, 모바일 Client Hints, 데스크톱 모드 iPad, 주 입력이 터치인 기기는 제외한다. 화면 너비로 기기를 판정하지 않으므로 작은 데스크톱 창과 터치 지원 노트북의 마우스 입력은 사용할 수 있다. 모바일·태블릿용 미니 모드는 제공하지 않는다.
- 사용자 클릭에서 `window.open`으로 일반 팝업을 열고 같은 React 대국 화면 하나를 옮긴다. 기본 창 장식을 유지해 창 상단의 OS 최소화·최대화·복원 기능을 사용한다. 항상 위 표시는 제공하지 않으며 다른 창에 가려질 수 있다. 웹에서 제어할 수 없는 실제 창 투명도나 게임 내부 최소화 API는 추가하지 않는다. 팝업이 차단되면 허용 방법을 안내하고 원래 대국 화면을 유지한다.
- 새 팝업은 원본 브라우저가 있는 모니터의 작업 가능 영역 중앙에 연다. 제목 표시줄·테두리를 포함한 실제 창 크기로 최초 위치를 보정하며 작은 화면에서는 창 크기를 가용 영역 안으로 줄인다. 이미 열린 팝업을 다시 볼 때에는 사용자가 옮긴 위치와 크기를 유지한다.
- `팝업 창 보기`는 클릭 안에서 해당 문서의 난수 창 이름을 `window.open("", name)`으로 다시 선택해 가려지거나 최소화된 기존 창을 활성화한다. 빈 URL로 문서 탐색·페이지 재생성·추가 참가를 하지 않으며 재선택 뒤에도 `opener`는 해제한다. 예상과 다른 빈 창이 만들어지면 즉시 닫고, 브라우저에서 거절하면 팝업 허용 설정을 안내한다.
- 별도 로그인·방 입장·SSE 연결·착수용 복제판을 만들지 않는다. CSS·로컬 폰트·nonce를 공유하며 기존 인증과 서버의 착수 검증을 그대로 사용한다. 팝업은 원본의 명시적 참조로 제어하므로 자식 문서의 `opener` 권한은 해제한다.
- 작은 창에는 두 참가자, 현재 차례·남은 시간, 20×20 판, 무르기, 원래 화면 복귀를 표시한다. 진행 중 기권·나가기는 더보기 메뉴에 배치하고 기존 확인 절차를 거친다. 대국 종료 후에는 판 아래에 재대국·나가기를 바로 표시한다. 무르기 응답·연결 복구·추첨·결과·재대국도 같은 창에서 처리한다. 창을 줄이면 정사각형 판을 가용 높이에 맞추고 극단적으로 작은 창에서는 스크롤한다.
- 원본 탭은 열어 두어야 한다. 팝업 닫기·원래 화면 복귀는 퇴장이나 기권이 아니며 원래 대국 화면을 복원한다. 팝업 자체의 새로고침·주소 이동도 원본으로 복원한다. 원본의 실제 화면 이동·새로고침·탭 종료·로그아웃은 기존 퇴장·복구 규칙을 유지하고 팝업도 정리한다. 나가기를 선택하면 원본 화면으로 복원한 뒤 방의 퇴장 확인창을 표시한다.
- 팝업의 입력 포커스와 타이머는 실제 표시 문서를 기준으로 처리한다. 원본 탭을 숨겨도 팝업이 보이면 활성 대국의 접속 확인 간격을 유지하고, 팝업을 닫을 때 타이머 예약을 원본 창으로 넘긴다. 최소화·숨김 중에도 서버의 턴 시간은 계속 흐른다. 기존 SSE 연결과 재접속 실패 예산은 창 전환으로 초기화하지 않는다.

## 저장과 화면

데스크톱 대국은 헤더·본문·푸터를 실제 표시 높이 안에 배치하고, 본문의 남은 높이에서 좌표판과 하단 동작 크기를 계산한다. 최대화·창 크기 변경 시에도 푸터를 표시하며 채팅 이력은 패널 내부에서만 스크롤한다. 큰 화면에서 판과 참가자 정보가 무제한 커지지 않게 상한을 두고, 작은 터치 화면은 기존 세로 배치와 문서 스크롤을 유지한다.

새 Flyway `V6__create_gomoku_matches.sql`이 `tbl_gomoku_match`, `tbl_gomoku_match_move`를 추가한다. 기존 V1~V5는 변경하지 않는다. 대국 당시 두 회원·참가 식별자·흑백·승패·남은 무르기·현재 착수·마감 시각을 저장하므로 방 참가 행이 퇴장으로 삭제되어도 결과의 당사자를 보존한다. 이 단계에는 전적/기보 조회 페이지나 랭킹을 추가하지 않는다.

데스크톱은 제공 시안의 왼쪽 참가자·타이머, 가운데 좌표판, 오른쪽 채팅 구조다. 판은 양옆 여백을 남기고 가운데 가용 너비를 채우며 좁은 화면에서는 참가자 정보, 판, 채팅 순서로 배치한다. 대국 중 방 제목·코드·규칙 안내와 판 크기·확대 선택기·아래 착수 버튼은 표시하지 않는다. 마우스는 빈 교차점에 올리면 미리보기만 표시하고 클릭하면 착수한다. 터치·펜은 첫 번째 입력에서 위치를 표시하고 같은 교차점을 두 번째 누를 때 확정하며 다른 교차점을 누르면 선택만 옮긴다. 입력 종류는 화면 너비 대신 실제 PointerEvent로 구분하므로 태블릿의 마우스도 즉시 클릭 착수를 사용한다. 방향키로 좌표를 이동하고 Enter/Space로 착수하며 Escape로 미리보기를 취소할 수 있다. 브라우저의 기본 확대·스크롤은 유지한다. 턴 변경·탭 숨김·창 포커스 해제 시 이전 선택을 무효화하고 빠른 연속 입력도 한 번만 전송한다. 대기실에서 대국으로 바뀌어도 채팅 컴포넌트는 유지한다.

승리와 패배는 같은 흰색·보라색 캐릭터의 다른 표정으로 표현한다. 결과 문구 `승리!`/`패배`/`무승부`와 다시하기/나가기 버튼은 HTML로 표시한다. 결과 대화상자를 닫으면 최종 판을 볼 수 있다. 일반 화면과 팝업 모두 판 위의 종료 안내·결과 보기·다음 판 안내는 표시하지 않고, 판 아래에 `한 판 더 하기`와 `나가기`를 배치한다. 재대국을 신청하면 같은 버튼이 비활성화되고 `상대의 재대국을 기다리고 있어요`로 바뀐다. 두 사람의 신청이 모두 확인된 뒤 서버 응답에 따라 다음 판으로 전환한다.

## 캐릭터 이미지 제작 지시

내장 `image_gen` 도구를 사용했다. 사용자 제공 대국/패배 시안은 스타일 참고 자료이며 이미지 전체를 게임 화면으로 사용하지 않는다. 아래 두 PNG는 투명 배경을 유지한 프로젝트 자산이다.

- `public/images/gomoku/result-victory.png`
- `public/images/gomoku/result-defeat.png`

승리 자산의 최종 프롬프트:

```text
Use case: stylized-concept. Asset type: transparent website game-result mascot. Input images 1 and 2 are ONLY visual style and character reference, not edit targets. Generate ONE separate reusable bitmap mascot asset for the VICTORY state, not a screenshot, interface, poster or sheet. Match the cute white little rounded fluffy ghost/mochi creature in the defeat popup of reference image 2: white pear-shaped body, small curled tuft of hair, tiny round paws, soft lavender shadowing and pink cheek blush, adorable friendly 3D clay render. This time the SAME CHARACTER is joyful and celebrating a game win, upright with both tiny paws raised, beaming crescent eyes and happy smile, surrounded by a few subtle purple and gold confetti and sparkles. Framed horizontally, centered entire character with generous margins, soft lavender ground glow. Genuine transparent alpha background. No card, no panel, no UI, no written text, no letters, no numbers, no watermark. Crisp polished pastel 3D casual game style, white and lilac palette consistent with the screenshot. Save as a single isolated character illustration.
```

패배 자산의 최종 프롬프트:

```text
Use case: stylized-concept. Asset type: isolated transparent game-result mascot, one bitmap. Reference image 1 is the user's defeat popup concept; reference image 2 is the approved matching VICTORY mascot asset, use the same exact white little mochi ghost creature identity, curled head tuft, little round paws, lavender shading and pink cheeks. Create the matching DEFEAT mascot illustration only: the SAME creature lies slumped flat with paws resting on the floor in front, drooping dark purple eyes, tiny sad curved mouth, cute and gentle disappointment, tiny lavender sigh/scribble floating above one side, a few soft purple puff clouds behind. Match the defeat character in image 1 closely and match the rendering/material/palette of image 2. High-quality polished soft 3D clay game illustration, white and lavender. Wide horizontal composition with all elements fully visible and generous margins. Genuine transparent alpha background. No UI, no card, no popup panel, no text, no lettering, no words, no watermark. Single isolated defeat character asset.
```
