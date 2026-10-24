import type { AdminUser } from "../user-contracts";

/** 서버가 한국 시간으로 저장한 현지 시각 문자열을 임의의 브라우저 시간대로 바꾸지 않는다. */
export const displayDate = (value: string | null) => value ? value.replace("T"," ").replace(/\.\d+$/,"") : "—";
export const userStatus = (user: AdminUser) => user.deleted ? "탈퇴" : ({ACTIVE:"활성",INACTIVE:"비활성",PENDING:"가입대기"}[user.status]);
