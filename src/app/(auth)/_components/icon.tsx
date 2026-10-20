import type { ReactNode } from "react";

const paths = {
  // 로그인·가입 아이디 필드는 같은 사용자 SVG 아이콘을 사용한다.
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  // 닉네임은 다른 사용자에게 표시되는 이름을 나타내는 이름표로 구분한다.
  badge: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M7 12h10M7 16h6" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="12" rx="2" />
      <path d="M7.5 10V6a4.5 4.5 0 0 1 9 0v4M12 15v3" />
      <circle cx="12" cy="14.5" r=".7" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3 3 21 21M9.8 5.7A12 12 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a18 18 0 0 1-3.1 3.8M6.1 6.3A18 18 0 0 0 2 12s3.5 6.5 10 6.5a12.5 12.5 0 0 0 5.2-1.1M10 9.8a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  arrow: <path d="M4 12h16m-7-7 7 7-7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
} satisfies Record<string, ReactNode>;

type IconProps = {
  name: keyof typeof paths;
  className?: string;
};

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
