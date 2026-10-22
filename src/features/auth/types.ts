/** 브라우저에 제공할 수 있는 인증 계약만 정의하며 토큰 타입은 서버 모듈에 둔다. */
export type LoginInput = Readonly<{
  username: string;
  password: string;
  keepLoggedIn: boolean;
  // 다른 로그인을 종료하는 재요청에만 true를 보내며, 생략한 첫 요청은 기존 로그인을 유지한다.
  replaceExistingSession?: boolean;
}>;

/** 가입 화면과 BFF는 필수 세 항목만 전달하며 선택 개인정보나 계정 상태는 브라우저에서 받지 않는다. */
export type SignUpInput = Readonly<{ nickname: string; username: string; password: string }>;
export type SignUpField = keyof SignUpInput;
export type SignUpFieldErrors = Readonly<Partial<Record<SignUpField, string>>>;

export type CurrentSession = Readonly<{
  id: number;
  username: string;
  // 화면과 변경 요청의 세션 일치 여부만 확인하는 공개 식별자이며 인증 토큰으로 사용하지 않는다.
  sessionId: string;
  keepLoggedIn: boolean;
  sessionExpiresAt: string;
}>;

/** 이전 탭의 작업이 새 계정에 적용되지 않도록 실제로 화면에 표시한 세션을 요청에 결합한다. */
export type SessionMutationInput = Readonly<{ sessionId: string }>;

export type SessionActivity = Readonly<{
  keepLoggedIn: boolean;
  expiresAt: string;
}>;
