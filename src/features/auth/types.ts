/** 브라우저에 제공할 수 있는 인증 계약만 정의하며 토큰 타입은 서버 모듈에 둔다. */
export type LoginInput = Readonly<{
  username: string;
  password: string;
  keepLoggedIn: boolean;
}>;

export type CurrentSession = Readonly<{
  id: number;
  username: string;
  keepLoggedIn: boolean;
  sessionExpiresAt: string;
}>;

export type SessionActivity = Readonly<{
  keepLoggedIn: boolean;
  expiresAt: string;
}>;
