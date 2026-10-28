import {object} from "@/features/social/contracts";

/** 수락 영수증만 방 이동에 사용한다. 거절·취소 응답의 방 번호로 이동하지 않는다. */
export type GomokuInvitationDecision = Readonly<{
  state: "PENDING"|"ACCEPTED"|"REJECTED"|"CANCELLED";
  roomId: number|null;
}>;
export function isGomokuInvitationDecision(value: unknown): value is GomokuInvitationDecision {
  return object(value)&&["PENDING","ACCEPTED","REJECTED","CANCELLED"].includes(value.state as string)
    &&(value.state==="ACCEPTED"?typeof value.roomId==="number"&&Number.isSafeInteger(value.roomId)&&value.roomId>0:value.roomId===null);
}

/** 서버 시각과 경과 시간만 사용해 사용자 PC 시계 변경이나 백그라운드 타이머 정지로 기한이 늘어나지 않게 한다. */
export function invitationRemaining(expiresAt: string, serverTime: string|undefined, snapshotAt: number, now: number): number {
  if(!serverTime)return 0;
  const remaining=Date.parse(expiresAt)-Date.parse(serverTime)-Math.max(0,now-snapshotAt);
  return Number.isFinite(remaining)?Math.max(0,remaining):0;
}
