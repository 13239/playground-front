# 공통 선택·날짜·검색 컨트롤

프로젝트의 선택 목록과 달력, 검색 입력은 `src/components/ui`에서 관리한다. 보라색 선택 표시·흰색 팝업·공통 1px 포커스·rem 크기를 공유한다. 팝업은 네이티브 최상위 레이어로 표시하고 화면 여백에 맞춰 위아래 위치와 높이를 계산한다. 실제 홈 게임 검색과 방 검색 입력은 사용자의 유지 요청에 따라 기존 구현을 사용한다.

## 단일 선택

`Select`는 `label`, `options: { value, label, disabled?, description? }[]`를 받는다. 제어 입력은 `value`와 `onValueChange`, 비제어 입력은 `defaultValue`를 사용한다. 폼 저장 항목이면 `name`을 지정한다. 페이지·탭 이동용 선택에는 이름을 주지 않아 미저장 변경으로 처리하지 않는다. `required`, `disabled`, 외부 fieldset의 비활성화, `aria-invalid`, `aria-describedby`도 지원한다.

```tsx
import { Select } from "@/components/ui/select";

// 폼 제출 시 status 값을 기존 FormData에서 그대로 읽는다.
<Select label="계정 상태" name="status" defaultValue="ACTIVE"
  options={[{ value: "ACTIVE", label: "활성" }, { value: "INACTIVE", label: "비활성" }]} />
```

방향키·Home/End·문자 입력으로 탐색하고 Enter/Space/Tab으로 적용한다. Escape나 바깥 클릭은 값을 바꾸지 않고 닫는다. 비활성 옵션은 선택하지 않는다. 네이티브 컨트롤은 화면에서 숨기고 폼 값·검증·reset과 버블링 변경 이벤트만 담당한다. 이 연결을 숨긴 일반 문자열이나 임의의 수동 submit으로 대체하지 않는다. 페이지 개수의 `PageSizeSelect`는 이 컴포넌트에 숫자 선택지만 전달하는 래퍼다.

## 검색 다중 선택

`Combobox`는 `SelectOption` 형식의 `options`와 `selected`, `onSelectionChange`를 받는다. 검색어·열림 상태는 `query/onQueryChange`, `open/onOpenChange`로 연결한다. 비동기 목록은 `loading/error/onRetry`, `hasMore/moreBusy/moreError/onLoadMore`로 연결한다. `maxSelections`로 선택 수를 제한할 수 있다. 선택 라벨은 조회 결과와 별도로 유지하며 비활성화된 기존 선택도 해제할 수 있다.

조회 API·페이지 취소·저장·권한과 업무 변경 감지는 기능별 래퍼에서 처리한다. `GenreCombobox`가 기존 장르 조회 훅과 최대 선택 개수를 연결하는 예시다. 입력·키보드·체크·선택 라벨·팝업 스타일은 다시 만들지 않는다.

## 달력

`DatePicker`는 문자열 `value/onValueChange` 또는 `defaultValue`를 받는다. 직접 날짜를 입력하거나 달력에서 연도·월·날짜를 선택할 수 있다. 윤년·실제 존재하는 날짜·최소/최대 범위와 필수 입력을 검증한다. 날짜 계산은 시간대 영향이 없는 UTC 날짜 연산을 사용하고 ‘오늘’만 사용자의 현재 지역 날짜를 사용한다.

```tsx
import { DatePicker } from "@/components/ui/date-picker";

// API 검색 날짜 형식은 변환 없이 YYYY-MM-DD로 유지한다.
<DatePicker label="조회 시작일" value={from} onValueChange={setFrom}
  min="1000-01-01" max="9999-12-30" required />
```

달력 아이콘이나 Alt+아래 방향키로 열고 날짜에 포커스를 둔다. 방향키는 일/주, Home/End는 주 시작/끝, PageUp/PageDown은 월, Shift+PageUp/PageDown은 연도를 이동한다. 연도·월 제목은 빠른 선택 보기를 연다. Escape는 달력만 닫고 부모 모달은 유지한다. 지우기는 필수 입력도 비울 수 있지만 비운 값으로 폼을 제출할 수는 없다.

## 검색

`SearchInput`은 일반 input 속성과 `label`을 받는다. 기본 돋보기는 가장 가까운 폼의 submit을 실행한다. 폼 안에서 별도 검색이 필요한 경우 `onSearch`를 지정하면 클릭·Enter가 그 콜백만 실행한다. 텍스트 필터가 즉시 반영되는지는 호출자의 기존 상태 관리에 맡긴다. 폼 제출·검색 조건을 UI 컴포넌트가 임의로 재전송하지 않는다.

```tsx
import { SearchInput } from "@/components/ui/search-input";

// 부모의 저장 submit과 분리된 조회만 실행한다.
<SearchInput label="권한 검색" value={query} onChange={event => setQuery(event.target.value)}
  placeholder="이름 또는 코드 검색" onSearch={searchRoles} />
```

새 선택·날짜·검색 UI는 이 컴포넌트를 사용한다. ESLint는 공통 연결부 외의 네이티브 select/date와 유지 대상 두 입력 외의 네이티브 search 추가를 차단한다. 팝업과 키보드·폼 연결을 바꿀 때는 비활성화·reset·필수 값·FormData·중첩 모달·모바일 배치를 함께 검증한다. 작업에서 새로 만든 검증 코드는 실행 후 제거한다.

키보드 동작은 [WAI-ARIA Combobox 지침](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)과 [날짜 선택 예제](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)를 참고한다. 팝업 레이어 동작은 [MDN Popover API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)를 따른다.

## 적용 검증 (2026-10-27)

실제 로그·채팅 패널과 방 설정 필드를 격리된 브라우저 응답으로 확인했다. 선택·검색 조건과 표시 개수의 요청 반영, 공용 채팅에서 게임·방 번호 잠금, 금수 코드 유지, FormData·제어/비제어 reset·필수 검증·독립 검색의 부모 제출 방지·모달 수정 감지·Escape를 검증했다. 달력은 윤년·월말·최소/최대 연도·잘못된 날짜·범위 제한·인접 월 클릭·연월/키보드 이동을 확인했다. 새 로딩에서 브라우저 경고·오류가 없었다.

320·390·768·1920·2560·3840·4096px에서 페이지 가로 넘침과 팝업 경계, 날짜 입력 가독성을 확인했다. 5120px 요청은 검증 브라우저가 4096px로 제한해 5K 실측에는 포함하지 않았다. 임시 검증 페이지는 실행 후 삭제했다.
