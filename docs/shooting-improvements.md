# 슈팅게임 개선 — 2026-10-29

승인한 방 만들기 B안과 대기실 C안을 적용했다. 비밀방 라벨은 방 제목 바로 옆에, 방 코드는 나가기 버튼 바로 왼쪽에 둔다.

## 반영한 13가지

| 번호 | 요청 | 반영 동작 |
| --- | --- | --- |
| 1 | 몬스터 공격 완화 | 일반 몬스터·보스의 원거리 공격을 공격당 탄환 하나 또는 포격 지점 하나로 통일 |
| 2 | 2인 모드 다시하기·나가기 | 결과 화면에서 각자 선택. 남은 참가자 모두 동의하면 같은 방의 대기실로 돌아가며 나간 사람만 방 목록으로 이동 |
| 3 | 방 코드 이동 | 대기실 상단 나가기 왼쪽. 복사 기능 유지 |
| 4 | 방 목록 버튼 삭제 | 대기실의 중복 방 목록 버튼 제거 |
| 5 | 방장 자동 승계 | 방장의 명시적 퇴장 시 남은 참가자에게 승계. 비정상 단절은 기존 15초 재접속 유예 뒤 처리 |
| 6 | 방 목록 자동 반영 | 인증된 SSE·Redis 변경 알림으로 갱신. 최대 750ms 단위로 변경을 합치고 30초 보정 조회로 유실·만료 복구 |
| 7 | 경험치 자동 획득 | 처치 즉시 기존 팀 공통 경험치에 누적. 파란 경험치 드롭 생성 안 함 |
| 8 | 수거 유예 제거 | 클리어 순간 미수거 아이템 제거. 3초 수거 안내 제거, 0.8초 클리어 전환만 표시 |
| 9 | 내 캐릭터 표식 | 닉네임·YOU 대신 `나`만 표시. 구조 상태는 HUD 안내 유지 |
| 10 | 게임 소리 | 사격·피격·폭발·강화·회복·클리어·종료 합성 효과음, 소리 켜기/끄기. 사용자 조작 후 AudioContext 활성화 |
| 11 | 비밀방 | 방 이름 1~20자, 공개/비밀 선택, 비밀번호 4~32자. 목록 자물쇠 표시 및 참가 비밀번호 입력 |
| 12 | 남은 게임 사용권 오류 | 퇴장 확인 응답 전에 사용권 반환. 소켓 없는 생성 예약은 사용권 확보 안 함. 종료·실패·취소·새 도전 경계 정리 |
| 13 | 오류 알림 닫기 | 목록 상단과 연결 알림에 접근 가능한 X 버튼 제공. 표시만 닫고 인증·연결 상태는 우회하지 않음 |

## 상태·보안 경계

- 비밀번호 원문은 URL·공유 상태·방 목록·백엔드 표시 데이터에 넣지 않는다. Node 서버 메모리에서 무작위 salt와 scrypt 결과로 검증하며 사용자별 방 비밀번호 확인은 분당 5회로 제한한다.
- 기존 BFF·JWT·브라우저 개인키·일회용 게임 티켓·내부 HMAC 인증을 유지한다. 비밀방 초대 링크에도 비밀번호가 필요하다.
- 퇴장 사용권은 기존 비교 후 삭제 Lua를 유지한다. 이전 방의 지연된 퇴장이 새 방의 사용권을 삭제하지 않는다.
- 방 목록 삭제는 이전 방장·세션이 새 방장의 목록을 지우지 못하도록 소유권을 확인한다. 같은 하트비트는 변경 알림을 반복 발행하지 않는다.
- 다시하기는 새 run ID·초기 전투 상태로 시작한다. 참가 중인 소켓·방 코드·비밀방 설정은 유지하고 운영 정책·현재 세션 권한은 다시 확인한다.
- 이전 도전에서 떠난 참가자는 새 도전의 신원 목록에서 제거한다. 기존 이동 예측·입력 순서도 재도전 경계에서 비운다. 방장 승계 후 새 참가자의 색은 남은 팀원과 겹치지 않는다.
- 다른 탭에서 실제 플레이 중인 계정에 대한 중복 참가 차단은 유지한다. 서버 강제 종료·네트워크 장애로 반환이 불가능한 사용권은 기존 45초 TTL로 만료된다.

## 검증

- 실제 Colyseus 서버·SDK 소켓 두 개를 사용한 격리 게임 검증 **17개 통과**. 인증 백엔드는 검증용 가짜 저장소를 사용하며 실제 사용자 계정은 만들지 않았다. 방장 승계, 승계 후 재참가, 잘못된 비밀번호, 즉시 새 방 만들기, 취소된 좌석 예약, 중복 탭 차단 유지, 다시하기 동의·상대 퇴장·점검 정책·모든 사용권 반환을 확인했다.
- 실제 Redis에서 UUID 검증 전용 키만 사용한 Lua 검증 **5개 통과**. 즉시 변경 전파, 동일 하트비트 알림 억제, 소유권 승계, 옛 방장의 삭제 차단, 사용권 반환 뒤 목록 삭제를 확인하고 검증 키를 제거했다.
- Spring MockMvc·세션 저장소 mock 격리 검증 **2개 통과**. SSE ready/changed 전달과 사용자별 동시 구독 4개 제한을 확인했다.
- game 타입 검사, 수정한 프론트 소스 ESLint, Next.js production 빌드를 통과했다. 수정한 백엔드를 local 프로필로 재기동했다.
- 앱 내 브라우저에서 실제 생성·대기실 컴포넌트를 별도 임시 페이지로 렌더링했다. FHD 1920×1080, QHD 2560×1440, 4K 3840×2160, 4096×2880, 1280×720, 1024×768, 태블릿 768×1024, 모바일 390×844·844×390에서 페이지 가로 넘침이 없었다. FHD에서는 생성·대기실이 한 화면에 들어왔으며 좁거나 낮은 화면의 필요한 세로 스크롤은 유지했다.
- 오류 X 버튼, 공개/비밀 선택, 비밀번호 입력, 생성 후 대기실 전환, 제목 옆 비밀방 표시, 결과의 다시하기/나가기 버튼을 화면에서 확인했다. 이 UI 검증 페이지는 인증·실제 전투와 분리했다.
- **미검증:** 로그인한 실제 사용자 두 명의 전체 전투 플레이, 실제 청취, Chrome·Edge·Firefox·Safari 각각의 실행 비교, 5K 5120px. 앱 내 검증 브라우저는 요청한 5120px를 4096px로 제한하여 5K 검증으로 계산하지 않았다. 브라우저 엔진 버전도 확인하지 못했다.
- 새로 작성한 테스트 소스·임시 UI 페이지·검증 서버는 삭제했다. 기존 테스트는 유지한다. 결과 JSON·XML과 컴포넌트 화면 캡처는 작업 폴더의 `output/shooting-improvements`에 보관한다.

## 이미지 자산

방 만들기 장식: `public/images/shooting/room-arena.webp` (약 109KB). 기본 ImageGen 도구로 승인된 시안의 전장 삽화를 참조해 생성한 뒤 웹용 WebP로 인코딩했다. 실제 폼·문구는 이미지가 아니라 HTML로 렌더링한다.

생성 프롬프트:

> Extract and redraw ONLY the tall top-down shooting arena illustration seen in the LEFT sidebar of this approved UI reference, as a standalone polished game illustration to use as that sidebar's background. No UI, no text, no labels, no borders, no typography, no controls. Portrait 2:3 composition. A dark blue steel-tiled industrial combat arena with several chunky metallic crates and subtle hazard stripes; a small cyan armored soldier above and a small coral red enemy soldier below; top-down orthographic stylized game art, subtle cone flashlights, tiny red and cyan particle accents, sophisticated sober blue-grey palette matching the provided reference. Keep the aesthetic, layout and level of detail of the reference illustration. Bottom quarter fades gently to deep navy #0c1520 so HTML title text may be placed there. Absolutely no letters or words, realistic implementable static game artwork. Full bleed.
