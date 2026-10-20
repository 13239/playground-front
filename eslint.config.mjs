import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 사용자 입력을 실행 가능한 HTML/코드로 바꾸는 경로가 새로 추가되면 빌드 전에 차단한다.
    rules: {
      "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error",
      "no-restricted-syntax": ["error", { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "사용자 입력은 React 텍스트로 출력하세요. HTML 허용은 별도 정화 설계가 필요합니다." }],
      "no-restricted-properties": ["error", { property: "innerHTML", message: "텍스트 출력 또는 검증된 정화 경계를 사용하세요." },
        { property: "outerHTML", message: "HTML 문자열 삽입을 허용하지 않습니다." }, { property: "insertAdjacentHTML", message: "HTML 문자열 삽입을 허용하지 않습니다." },
        { object: "document", property: "write", message: "동적 HTML 출력을 허용하지 않습니다." }],
    },
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
