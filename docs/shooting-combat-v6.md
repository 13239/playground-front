# 슈팅게임 맵별 공략 전투 — 규칙 버전 6

작업일: 2026-11-05. 난이도 방향은 사용자가 선택한 **몇 번 재도전하며 공략을 익히는 수준**이다. 실제 사람의 자연 플레이에 따른 체감 난이도 확정과 별 기준 재조정은 별도 플레이 검증이 필요하다.

## 적용한 동작

- 기존 6개 맵에 각각 10개씩, 총 60개의 고정 임무 레시피를 정의했다. 19개 행동을 재사용하며 60개 레시피의 전체 행동 순서가 서로 중복되지 않는지 검사했다. 60개의 완전히 독립적인 기본 원리를 의미하지는 않는다.
- 모든 구간은 필수 공략 완료와 적 처치가 모두 필요하다. 보스 구간은 공략으로 방어를 해제한 뒤 보스를 처치한다. 몬스터 전멸이나 높은 공격력만으로 필수 목표를 생략할 수 없다.
- 5스테이지 수호자는 12초, 10스테이지 최종 보스는 10초의 약점 공격 시간을 얻는다. 시간이 끝나면 현재 단계의 공략을 다시 수행하며 남은 보스 체력은 유지한다.
- 최종 보스는 체력 65%·35%에 방어를 복구하고 공략의 순서·배치를 변경한다. 같은 틱의 여러 탄환이나 큰 폭발 피해로 체력 경계를 건너뛰지 못한다.
- 공략의 각 행동 완료 시 예약 공격·탄환을 제거하고 적에게 짧은 그로기를 적용한다. 반복 공략으로 경험치를 추가 지급하지 않는다.
- 기존 대시의 0.3초 재사용·거리 95·무적 없음, 무적 아이템 E, 부활과 성장·무기 선택은 유지한다.

## 맵과 회피

| 맵 | 공략 중심 | 추가 환경 압박 |
| --- | --- | --- |
| 수정 동굴 | 반사 법선·발사 위치, 공명 박자, 포격 유도 | 이동 방향 앞의 낙석 예고 |
| 태엽 공장 | 순서 연결, 개방 순간 사격, 움직이는 부품 회수 | 방향이 바뀌는 직선 레이저 |
| 덩굴 정원 | 씨앗 운반·성장, 뿌리 역순 절단, 바람 방향 사격 | 중심·바깥 고리가 교대하는 개화 공격 |
| 모래 유적 | 정지해서 진동 탐지, 발자국 순서 추적, 근접 실체 확인 | 잠복 지점과 세로 모래 파동 |
| 얼음 협곡 | 7초 불씨 운반·재충전, 포격으로 얼린 표식 대시, 이동 안전 지대 | 둔화를 고려해 1.5초 예고하는 대각선 균열 |
| 용암 성채 | 밸브로 압력 43~58% 유지, 냉각수 운반 후 사격을 멈추고 급랭 | 중심·고리 분출과 기존 분출구 |

원·고리·직선의 충돌 계산을 공유 패키지의 `hazardContains`로 정의하고 렌더러도 동일한 크기·방향을 그린다. 새 환경 공격과 포격은 동시 강공격 예산, 중첩되는 예고, 둔화 상태에서 이동 가능한 회피 후보를 검사하고 필요하면 지연한다. 이 검사는 모든 탄환과 미래의 모든 이동을 완전 탐색하는 무피격 보장은 아니다.

## 복구·협동·조작

- 새 단축키 없이 이동·사격·대시로 공략한다. 운반물은 몸으로 회수한다. 네 종류 무기로 같은 필수 목표를 달성할 수 있다.
- 순서 오류는 재시도, 발자국은 다음 표식까지 4.5초 초과 시 처음부터 재추적한다. 공명·차단은 표적 사격 간 0.6초 정적과 개방 순간을 검사한다.
- 운반자가 쓰러지거나 떠나면 물자를 출발 위치로 복구한다. 불씨는 7초 후 복구되며 출발 화로에서 충전된다. 필수 포격은 일반 적이 모두 사라진 뒤에도 다시 유도할 수 있다.
- 협동의 순서·성장·운반 진척은 공유한다. 표식 가까이 온 사람이 포격 유도를 맡고, 살아 있는 한 사람도 목표를 진행할 수 있다.
- 이동 안전 지대는 안에 완전히 들어온 플레이어를 환경·포격 피해로부터 보호한다. 일반 탄환·접촉 피해에는 별도 대응해야 한다.
- 일시정지·강화 선택·재접속 정지 동안 공략 시간은 흐르지 않는다.
- 현재 행동, 대응 힌트, 보스 약점 시간을 HUD에 표시한다. 필수 노드의 출발·발사점은 푸른색, 현재 목표·개방은 금색, 안전 지대는 녹색이다. 문자·방향·진행 호도 함께 표시한다.
- 좁은 카메라 밖의 목표는 방향과 이름을 화면 가장자리에 표시한다. 힌트는 최소 14px로 줄바꿈하고, 렌더링 노드·라벨은 재사용한다.

## 확장 구조

- `playground-game/packages/shooting-shared/src/missions.ts`: 맵별 임무 이름·행동 순서·압박 패턴과 공개 노드 타입.
- `playground-game/src/simulation/missions.ts`: 서버 권한의 공략 상태·실패 복구·공격 기회 실행.
- `playground-game/src/simulation/combat.ts`: 실제 탄환 직격, 보스 방어, 환경 압박·안전 후보 검사.
- `playground-game/src/network/state.ts`: 공개 진행 상태·노드·공격 경계 직렬화. 내부 콜백과 예약 정보는 전송하지 않는다.
- 프론트 `engine/mission-art.ts`, `arena.ts`, `components/battle-hud.tsx`: 공개 상태에 대한 표시. 클라이언트가 공략 성공이나 피해를 제출하는 경로는 추가하지 않았다.

새 맵은 10개 임무 레시피와 맵 설정을 추가하고, 새로운 원리가 필요하면 행동 실행·표현을 함께 확장한다. 기존 행동을 조합하는 것만으로 무한한 독창성을 보장하지 않는다. **현재 계정 해금의 숫자 비트마스크는 이번 6개 맵 범위에서 유지했다. 수십~100개 맵으로 확장하기 전에는 게임 서버·프론트·Spring의 해금 계약을 안정적인 맵 ID 기반 구조로 함께 전환해야 한다.**

## 기록과 실행

공유 전투 규칙과 Spring 규칙을 버전 6으로 맞췄다. 과거 버전 3·4·5의 별과 해금은 보존하며 랭킹·현재 최고 시간은 버전 6만 비교한다. 기존 별 시간 수치는 유지했다. DB 스키마 변경은 없다.

네트워크 공개 필드와 전투 규칙이 함께 변경되었으므로 **front·playground-game·playground-back을 함께 갱신하고 재시작**해야 한다. 구버전 전투가 진행 중인 서버에 새 프론트만 연결하지 않는다. 작업 중 기존 사용자 서버를 종료하거나 실제 기록 DB를 변경하지 않았다.

## 실행한 검증

- 게임 서버 TypeScript 검사, 프론트 TypeScript·수정 슈팅 기능 ESLint, Java 25 Gradle `compileJava` 검증.
- 임시 화면·테스트 삭제 후 최종 Next.js 16.4.2 Turbopack 프로덕션 빌드 통과. 제한된 실행 환경에서 멈춘 첫 빌드는 종료하고 일반 프로세스 권한으로 재검증했다. 기존 `features/auth/server/login-audit.ts`의 동적 파일 경로 추적 경고 6개는 남아 있으며 이번 슈팅 변경과 별개다.
- 60개 레시피 × 1인/협동 = 120개 해결 경로, 최종 보스의 추가 24개 단계 레시피, 벽·경계와 노드 배치 검사.
- 공개 노드·진행의 Colyseus 실제 encode/decode, 적 전멸 후 미완료 공략의 클리어 차단, 일시정지 시 시간 동결.
- 6개 최종 보스의 초기 방어·65%·35% 체력 경계, 과도한 피해와 동시 추가 피해에 의한 단계 생략 차단.
- 소총·산탄총·저격총·유탄발사기 각각 실제 탄환으로 순서 노드 직격 및 반사 공략 완료.
- 운반 중 사망·불씨 소진·협동에서 한 명만 생존한 경우의 복구, 연사로 타이밍 목표를 생략하는 시도·잘못된 순서 사격 거절, 보스 약점 시간 만료 후 재시도.
- 6개 맵 × 1인/협동의 12개 전체 상태 전환, 각 10개 구간 기록과 최종 완료.
- 앱 내 Chromium 브라우저의 실제 Phaser·시뮬레이션·HUD를 연결한 임시 화면에서 6개 맵의 공략과 최종 보스 방어 표시를 확인했다. 임시 화면은 인증·기록 API를 사용하지 않았다. 검증용 조작 버튼과 보호 상태는 제품 코드에 포함하지 않는다.
- CSS 뷰포트 1920×1080, 1280×720, 768×1024, 390×844, 844×390, 2560×1440, 3840×2160, 4096×2880에서 가로 넘침 없이 목표·힌트 표시. 힌트 글자는 모바일 14px, FHD 14.784px, QHD 17.112px, 4K 21.768px이다. 낮은 창의 필요한 세로 스크롤은 허용한다.

자동 해결 경로와 전체 상태 전환 검사는 좌표·입력 또는 처치를 제어한 판정 검사다. 자연 플레이의 재미·체감 난이도 검증을 대신하지 않는다. 실제 사용자 두 명의 장시간 협동, 실제 DB 저장, 모바일 멀티터치, Chrome·Edge·Firefox·Safari 개별 실행은 미검증이다. 앱 내 브라우저가 5120px 요청을 4096px로 제한했으므로 실제 5K도 미검증이다. 초기 임시 페이지의 잘못된 import 경로는 수정했으며 이후 최종 표시 중 새 오류는 관찰되지 않았다.

임시 테스트·화면·정리 도구는 검증 후 삭제하며 판정 결과와 화면은 루트 `output/shooting-v6-verification`에 보존한다.

## 60개 임무 목록

| 맵 | 구간 | 임무 | 행동 순서 |
| --- | --- | --- | --- |
| CAVE | 1 | 굴절된 입구 | reflect |
| CAVE | 2 | 공명의 박자 | resonate → dash |
| CAVE | 3 | 낙석 유도 | lure → reflect |
| CAVE | 4 | 갈라진 수정길 | dash → carry → resonate |
| CAVE | 5 | 수정 수호자의 균열 | lure → resonate |
| CAVE | 6 | 교차 굴절 | reflect → dash → reflect |
| CAVE | 7 | 공명석 운반 | carry → resonate → lure |
| CAVE | 8 | 붕괴 속의 광로 | dash → reflect → carry |
| CAVE | 9 | 삼중 수정 봉인 | resonate → lure → reflect → dash |
| CAVE | 10 | 수정갑왕의 재생 핵 | reflect → lure → resonate |
| FACTORY | 1 | 전력의 흐름 | circuit |
| FACTORY | 2 | 가동 순간 | pulse → circuit |
| FACTORY | 3 | 부품 분류선 | conveyor → pulse |
| FACTORY | 4 | 전력 분배실 | pressure → circuit → conveyor |
| FACTORY | 5 | 동력 관리자의 차단기 | circuit → pulse |
| FACTORY | 6 | 역방향 작업장 | conveyor → dash → circuit |
| FACTORY | 7 | 과부하 복구 | pulse → pressure → circuit |
| FACTORY | 8 | 회전선 사이로 | dash → conveyor → pulse |
| FACTORY | 9 | 비상 전력망 | pressure → conveyor → circuit → pulse |
| FACTORY | 10 | 태엽 지휘관의 동력망 | conveyor → pressure → pulse |
| GARDEN | 1 | 첫 씨앗 | grow |
| GARDEN | 2 | 뿌리의 근원 | prune → grow |
| GARDEN | 3 | 꽃가루 바람 | wind → prune |
| GARDEN | 4 | 움트는 길 | carry → grow → wind |
| GARDEN | 5 | 가시 수호자의 기생근 | prune → wind |
| GARDEN | 6 | 순환하는 정원 | grow → wind → carry |
| GARDEN | 7 | 번지는 기생망 | prune → grow → prune |
| GARDEN | 8 | 바람을 기다리는 씨앗 | wind → carry → grow |
| GARDEN | 9 | 개화 전야 | grow → prune → wind → carry |
| GARDEN | 10 | 만개 여왕의 수분 | wind → grow → prune |
| DESERT | 1 | 모래 아래의 신호 | listen |
| DESERT | 2 | 남겨진 발자국 | track → listen |
| DESERT | 3 | 신기루의 실체 | mirage → track |
| DESERT | 4 | 폭풍의 쉼터 | shelter → listen → mirage |
| DESERT | 5 | 유적 파수꾼의 흔적 | track → mirage |
| DESERT | 6 | 잠든 모래길 | listen → dash → track |
| DESERT | 7 | 가짜 표식 사이로 | mirage → shelter → listen |
| DESERT | 8 | 폭풍 속 운반 | track → carry → shelter |
| DESERT | 9 | 매몰된 봉인 | listen → mirage → track → shelter |
| DESERT | 10 | 사막 전갈왕의 잠복 | shelter → listen → track |
| ICE | 1 | 온기의 불씨 | heat |
| ICE | 2 | 얼어붙은 통로 | freeze → heat |
| ICE | 3 | 움직이는 온기 | shelter → freeze |
| ICE | 4 | 해빙의 순간 | heat → pulse → dash |
| ICE | 5 | 빙하 수호자의 관절 | freeze → heat → pulse |
| ICE | 6 | 빙결선 횡단 | dash → freeze → shelter |
| ICE | 7 | 불씨 중계 | heat → shelter → heat |
| ICE | 8 | 갈라지는 빙판 | freeze → dash → pulse |
| ICE | 9 | 협곡의 열 순환 | shelter → heat → freeze → dash |
| ICE | 10 | 서리 용왕의 급랭 | heat → freeze → shelter |
| VOLCANO | 1 | 압력 조절 | pressure |
| VOLCANO | 2 | 차가운 한 방울 | coolant → pressure |
| VOLCANO | 3 | 분출을 돌려라 | lure → coolant |
| VOLCANO | 4 | 굳어지는 용암길 | coolant → dash → pressure |
| VOLCANO | 5 | 화산 문지기의 과열 | pressure → lure |
| VOLCANO | 6 | 분출 사이의 운반 | carry → coolant → dash |
| VOLCANO | 7 | 막힌 배출관 | pressure → coolant → lure |
| VOLCANO | 8 | 급랭 작업장 | coolant → pulse → pressure |
| VOLCANO | 9 | 성채의 임계점 | lure → pressure → coolant → dash |
| VOLCANO | 10 | 용암 군주의 균열 | coolant → pressure → lure |
