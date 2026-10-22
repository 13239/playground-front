# 오목 대국

## 동작

- 기존 `/games/gomoku/rooms/[roomId]`에서 대기실 → 제비뽑기 → 대국 → 결과 → 재대국으로 이어진다.
- 두 명 모두 준비하면 서버가 흑돌 카드를 무작위로 정한다. 각자 뒤집힌 카드 한 장을 선택하고 두 선택이 끝나면 동시에 공개한다. 20초 동안 선택하지 않은 카드는 서버가 배정한다. 공개 3초 후 흑부터 시작한다.
- 같은 참가자 두 명이 재대국하면 직전 패자가 흑이다. 무승부나 참가자 교체 후에는 다시 제비뽑기한다.
- 판은 20×20, 한 수는 30초다. 마감 시각에 도달하면 착수 없이 상대 턴으로 넘어간다. 클라이언트가 보낸 시각이나 승패는 사용하지 않는다.
- 자유 룰은 흑백 모두 5개 이상 연결하면 승리한다. 금수 적용 시 흑은 정확한 5목으로 승리하며 3·3, 4·4, 장목 착수는 거부한다. 백은 5개 이상으로 승리한다. 열린 3·가짜 3·중복 4의 판정은 [RIF 9.1~9.3](https://gomoku.renju.net/rifrules/) 정의를 따른다. RIF의 15줄 판·중앙 첫 수·대회 오프닝 규칙은 이 사이트의 20줄·제비뽑기 규칙과 별개다.
- 무르기는 상대 수락 전까지 판을 바꾸지 않는다. 수락하면 요청자의 마지막 착수부터 이후 돌까지 제거하고 요청자 차례, 새 30초로 복원한다. 각자 방 설정의 1/3/5회를 가지며 수락된 요청만 차감한다. 거절·10초 응답 만료·다음 착수·턴 패스는 요청을 취소하며 횟수는 차감하지 않는다. 응답 중에도 턴 시간은 흐른다.
- 판이 모두 차면 무승부, 기권 또는 대국 중 명시적 나가기는 패배다. 두 사람의 재대국 요청이 모두 있어야 다음 판을 만든다.
- 빠른 매칭 버튼과 향후 AI 대전 범위는 변경하지 않는다.

## 연결과 동기화

`POST /api/gomoku/rooms/game`은 카드 선택, 착수, 무르기 요청/응답, 기권, 연결 종료, 재대국을 처리한다. 요청은 `roomId`, `matchId`, `revision`, UUID `requestId`, `action` 및 해당 동작에 필요한 값만 보낸다. 방 행 잠금과 최신 대국·참가 검증으로 동시 착수와 지난 판의 명령을 막는다. 같은 직전 요청의 재전송은 한 번만 적용한다.

`POST /api/gomoku/rooms/game/events`는 기존 Origin·BFF 쿠키·JWT·브라우저 증명을 검증한 짧은 SSE 연결이다. 데이터 대신 변경 알림만 보내고 판은 기존 `state` API로 다시 조회한다. 연결은 20초 후 정상 만료되어 새 인증으로 갱신한다. 5초 주기 조회가 참가 접속, 채팅 리스, 누락된 알림을 복구한다. Redis Pub/Sub으로 다른 MVC 인스턴스에도 커밋된 변경 알림을 전달한다. BFF의 SSE 연결 풀은 일반 인증·착수 연결 풀과 분리한다. 프록시는 이 경로의 버퍼링을 끄고 스트림 취소를 상위 연결에 전달해야 한다.

첫 데이터 연결 실패 후 재접속은 최대 5회이며 대기 간격은 1·2·4·8·10초, 상태 요청 제한 시간은 5초다. 정상적인 SSE 만료나 로그인 만료는 게임 재접속 실패로 세지 않는다. 복구 성공 시 실패 예산을 초기화한다. 5회 소진 후에는 새 착수를 막고 결과 확인에서 본인의 연결 종료를 확정한다.

실패한 네트워크 요청과 닫힌 브라우저는 서버에 실패 횟수를 보고할 수 없으므로 서버는 별도의 접속 마감도 사용한다. 마지막 접속 확인 후 15초가 지나면 재접속 대기로 표시하고 65초 동안 복구하지 못하면 패배시킨다. 이 기간에도 턴 시간은 흐른다. 양쪽 동시 단절이나 긴 서버 중단은 특정 사용자의 패배로 만들지 않고 중단 무승부로 처리한다. 승패는 항상 서버 응답으로 표시한다.

대국 시계는 활성 판의 다음 마감만 메모리에 보관한다. 1초 주기는 메모리의 예약만 확인하며 마감에 도달한 방만 DB에서 읽는다. 대국이 없으면 주기적인 대국 DB 조회도 없다. 시작·접속 갱신·착수·종료의 예약 변경은 SQL 커밋 뒤 로컬 서버와 Redis 구독 서버에 반영한다. 지연된 알림은 마감을 늦추거나 새 판의 예약을 취소하지 못한다. 서버 시작과 Redis 재구독 때만 미종료 판을 배치 조회해 예약을 복구한다. 기존 대기실 만료 정리(30초 주기)는 별도로 유지한다.

## 화면 이동과 브라우저 종료

대기실·대국의 뒤로가기와 앱 내부의 다른 화면 이동은 퇴장으로 처리한다. 대국 중 퇴장은 기권 패배를 기록한 뒤 참가자를 삭제하고, 방장을 위임하거나 마지막 참가자가 나간 방을 닫는다. 이미 끝난 대국의 결과는 퇴장으로 덮어쓰지 않는다. 브라우저 앞으로가기나 BFCache로 퇴장한 화면을 복원하면 방 목록으로 이동한다.

새로고침은 참가를 유지한다. Navigation API를 지원하는 브라우저는 `reload`를 구분해 종료 알림을 보내지 않는다. 그 외의 문서 종료는 5초의 유예를 둔다. 새 문서의 `OPEN`이 새 페이지 식별자로 참가를 이어받으면 종료 예약을 취소한다. 따라서 새로고침을 직접 구분하지 못하는 브라우저에서는 5초 안에 새 문서의 접속 확인이 완료되어야 한다. 이전 페이지의 늦은 `CLOSE`와 이전 참가 식별자의 퇴장은 새 문서·재입장 참가를 삭제하지 못한다.

페이지 종료 요청은 살아 있는 동안 기존 브라우저 키·nonce로 미리 서명하고 `fetch`의 `keepalive`로 전송한다. `/api/gomoku/rooms/lifecycle`도 일반 API와 같은 Origin·BFF·JWT·Redis 세션·브라우저 증명을 검증한다. 쿠키만으로 퇴장시키는 공개 경로나 장기 토큰은 추가하지 않는다. 미리 만든 요청은 메모리에만 보관하고 실제 전송 시에도 기존 인증이 유효해야 한다. 새 화면의 `OPEN`은 문서마다 한 번만 보내며 서명 준비 갱신으로 방 상태의 DB 폴링을 추가하지 않는다.

Flyway V7은 참가 행의 `page_id`, `exit_deadline`과 인덱스를 추가한다. 종료 마감은 기존 메모리 시계·Redis 예약 알림을 공유하고 서버 시작·Redis 재구독 때 복구하므로 새 전역 DB 폴링이 없다. 브라우저 강제 종료·네트워크 단절처럼 종료 요청 자체를 보내지 못한 경우는 서버 접속 만료로 보완한다. 대국의 기존 5회 재접속·65초 서버 판정은 유지하고, 90초 이상 확인되지 않은 참가자는 기존 30초 정리 주기에서 대국 종료 후에도 제거해 방에 영구히 남지 않게 한다.

## 저장과 화면

새 Flyway `V6__create_gomoku_matches.sql`이 `tbl_gomoku_match`, `tbl_gomoku_match_move`를 추가한다. 기존 V1~V5는 변경하지 않는다. 대국 당시 두 회원·참가 식별자·흑백·승패·남은 무르기·현재 착수·마감 시각을 저장하므로 방 참가 행이 퇴장으로 삭제되어도 결과의 당사자를 보존한다. 이 단계에는 전적/기보 조회 페이지나 랭킹을 추가하지 않는다.

데스크톱은 제공 시안의 왼쪽 참가자·타이머, 가운데 좌표판, 오른쪽 채팅 구조다. 판은 양옆 여백을 남기고 가운데 가용 너비를 채우며 좁은 화면에서는 참가자 정보, 판, 채팅 순서로 배치한다. 대국 중 방 제목·코드·규칙 안내와 판 크기·확대 선택기·아래 착수 버튼은 표시하지 않는다. 마우스는 빈 교차점에 올리면 미리보기만 표시하고 클릭하면 착수한다. 터치·펜은 첫 번째 입력에서 위치를 표시하고 같은 교차점을 두 번째 누를 때 확정하며 다른 교차점을 누르면 선택만 옮긴다. 입력 종류는 화면 너비 대신 실제 PointerEvent로 구분하므로 태블릿의 마우스도 즉시 클릭 착수를 사용한다. 방향키로 좌표를 이동하고 Enter/Space로 착수하며 Escape로 미리보기를 취소할 수 있다. 브라우저의 기본 확대·스크롤은 유지한다. 턴 변경·탭 숨김·창 포커스 해제 시 이전 선택을 무효화하고 빠른 연속 입력도 한 번만 전송한다. 대기실에서 대국으로 바뀌어도 채팅 컴포넌트는 유지한다.

승리와 패배는 같은 흰색·보라색 캐릭터의 다른 표정으로 표현한다. 결과 문구 `승리!`/`패배`/`무승부`와 다시하기/나가기 버튼은 HTML로 표시한다. 팝업을 닫아 최종 판을 보고 결과 보기로 다시 열 수 있다.

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
