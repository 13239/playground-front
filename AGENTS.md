<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 입력창·게임 카드의 공통 상호작용 스타일

- 기존 화면과 새로 개발하는 화면 모두 `src/app/globals.css`의 공통 포커스 스타일과 `--control-focus-*` 변수를 사용한다.
- 입력창·텍스트 영역·선택 상자·편집 가능한 요소·커스텀 콤보박스는 포커스할 때 요소 가장자리에 붙는 1px 보라색 테두리를 표시한다. 굵은 링, 바깥 간격이 있는 외곽선, 포커스용 번짐 그림자를 추가하지 않는다.
- 검색 아이콘·글자 수·버튼이 입력창과 같은 테두리 안에 있으면 실제 바깥 프레임에 `data-focus-frame`을 붙인다. 내부 입력에는 포커스 테두리를 따로 만들지 않으며 포커스로 요소 크기나 배치가 바뀌지 않게 한다.
- 검증 오류가 있는 입력은 `aria-invalid="true"`를 사용해 포커스 중에도 오류 색을 유지한다. 체크박스·라디오처럼 입력을 숨긴 경우에는 실제 표시 영역에 공통 1px 테두리와 안쪽 오프셋을 적용한다.
- 게임 카드의 가장 바깥 요소에는 `data-hover-frame`을 붙인다. 마우스 호버와 키보드 포커스는 공통 1px 테두리를 사용하며, 클릭만으로 떨어진 굵은 테두리가 남지 않게 한다. 내부 링크의 중복 포커스 테두리는 해당 컴포넌트 범위에서 제거한다.
- 기존 코드의 주석을 유지하고, 공통 스타일을 우회해야 하는 변경에는 이유를 설명하는 주석을 추가한다.

## 페이지네이션

- 앞으로 새로 개발하는 화면의 페이징은 페이지 번호 방식으로 구현한다. 첫 페이지·이전·페이지 번호·다음·마지막 페이지 이동을 제공한다.
- 관리자 화면에서는 `src/features/admin/components/numbered-pagination.tsx`를 재사용할 수 있다. 유저 관리는 이 방식을 적용하며 이미 개발된 다른 화면의 페이징 전환은 별도 요청 시 진행한다.

## 모든 페이지의 크기와 반응형 기준

- 루트 레이아웃의 `.app-pages` 경계와 `src/app/globals.css`의 공통 레이아웃 변수를 사용한다. 새 페이지의 최상위 콘텐츠에는 `.app-page`를 적용한다.
- 기본 페이지는 `--layout-max-standard`, 밀도 높은 관리자 화면은 `data-page-width="wide"`와 `--layout-max-wide`, 게임은 `data-page-width="game"`와 `--layout-max-game`을 사용한다. 본문 폭은 화면에 맞춰 증가한 뒤 용도별 상한에서 멈춘다. 입력 카드는 `--layout-max-form`(32.5rem), 읽기용 안내는 `--layout-max-reading`(48rem)을 상한으로 사용한다. 자세한 수치는 `docs/responsive-layout.md`를 따른다.
- FHD 이후에도 본문 폭·내부 요소를 완전히 고정하지 않는다. 루트 글꼴은 기본값 100%에서 최대 125%까지 완만하게 증가하며, 본문 폭은 더 넓은 가용 공간을 활용한다. 기본 글자는 `--app-font-size`, 헤더는 `--app-header-font-size`, 여백은 `--layout-gutter`·`--layout-gap`·`--layout-panel-padding`을 재사용한다. 버튼·아이콘·행 높이는 rem/em으로 이 증가율을 공유하고 별도의 무제한 vw 확대나 `zoom`·`transform: scale()`을 추가하지 않는다.
- 일반 콘텐츠에 `min-height: 100vh/100dvh/100svh`, 불필요한 `flex: 1`, 화면 높이를 채우는 `1fr` 행을 추가하지 않는다. 본문·카드·푸터는 내용 높이를 사용하고 장식 배경만 전체 화면을 채운다.
- 인증 페이지는 사용자 요구에 따라 예외적으로 화면 높이와 위·아래 균등 행을 사용해 입력 카드를 화면 정중앙에 둔다. 헤더 높이·장식 삽화 여백으로 중심을 밀어내지 않고, 폼이 화면보다 길어질 때만 자연스러운 페이지 스크롤로 전환한다.
- 실제 게임처럼 가용 높이 계산이 필요한 경우에도 `--layout-game-height-max`와 `--layout-board-max` 상한을 적용한다. 새 페이지의 임의 상한을 별도로 복제하지 않는다.
- 열 수는 가능하면 실제 컨테이너 폭을 기준으로 정하고 항목이 적다고 카드가 남는 폭을 모두 차지하게 하지 않는다. 좁은 화면은 줄바꿈·열 축소·그리드의 가로 이동으로 대응하며 세로 길이는 실제 행 수를 따른다.
- 모바일·태블릿·FHD·QHD·4K급의 가로 넘침을 확인하고, 넓은 화면에서는 본문·글자·행 높이가 완만하게 증가한 뒤 상한에서 멈추는지 비교한다. 로그인 카드의 가로·세로 중앙 좌표도 확인한다. 브라우저 확대와 사용자가 지정한 글꼴 크기는 유지한다.
