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
