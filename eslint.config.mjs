import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 공통 컨트롤 밖의 브라우저 기본 UI 재도입을 막고 기존 HTML 실행 방지 규칙도 함께 유지한다.
const safeJsx = { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "사용자 입력은 React 텍스트로 출력하세요. HTML 허용은 별도 정화 설계가 필요합니다." };
const sharedControls = [safeJsx,
  { selector: "JSXOpeningElement[name.name='select']", message: "공통 @/components/ui/select의 Select를 사용하세요." },
  { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='date']", message: "공통 DatePicker를 사용하세요." },
  { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='datetime-local']", message: "공통 날짜 컨트롤을 확장해 사용하세요." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 사용자 입력을 실행 가능한 HTML/코드로 바꾸는 경로가 새로 추가되면 빌드 전에 차단한다.
    rules: {
      "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error",
      "no-restricted-syntax": ["error", safeJsx],
      "no-restricted-properties": ["error", { property: "innerHTML", message: "텍스트 출력 또는 검증된 정화 경계를 사용하세요." },
        { property: "outerHTML", message: "HTML 문자열 삽입을 허용하지 않습니다." }, { property: "insertAdjacentHTML", message: "HTML 문자열 삽입을 허용하지 않습니다." },
        { object: "document", property: "write", message: "동적 HTML 출력을 허용하지 않습니다." }],
    },
  },
  {
    files: ["src/**/*.tsx"], ignores: ["src/components/ui/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...sharedControls] },
  },
  {
    files: ["src/**/*.tsx"],
    // 홈·방 검색은 사용자가 기존 입력 UI 유지를 요청한 두 경로에만 예외를 둔다.
    ignores: ["src/components/ui/**/*.tsx", "src/app/_components/lobby/site-header.tsx", "src/features/gomoku/components/room-list.tsx"],
    rules: { "no-restricted-syntax": ["error", ...sharedControls,
      { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='search']", message: "공통 SearchInput을 사용하세요." },
    ] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
