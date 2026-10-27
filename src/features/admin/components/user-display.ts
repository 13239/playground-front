import { USER_STATUS_LABELS, type AdminUser } from "../user-contracts";

/** 서버가 한국 시간으로 저장한 현지 시각 문자열을 임의의 브라우저 시간대로 바꾸지 않는다. */
export const displayDate = (value: string | null) => value ? value.replace("T"," ").replace(/\.\d+$/,"") : "—";
// 삭제 표시는 계정 상태보다 우선하고 탈퇴는 WITHDRAWN 상태에서만 표시한다.
export const userStatus = (user: AdminUser) => user.deleted ? "삭제" : USER_STATUS_LABELS[user.status];
