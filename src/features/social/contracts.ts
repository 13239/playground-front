import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";
import type { PublicChatMessage } from "@/features/chat/client/protocol";
/** 친구 API와 본인 전용 실시간 연결에서 허용할 공개 데이터만 정의한다. */
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// 서버와 동일하게 유니코드 코드 포인트를 세어 이모지가 포함된 이름도 일관되게 검증한다.
const text = (v: unknown, max: number): v is string => typeof v === "string" && [...v].length <= max;
const id = (v: unknown): v is string => typeof v === "string" && uuid.test(v);
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export type Person = Readonly<{ publicId: string; nickname: string; avatarId: ProfileAvatarId; relation: "SELF"|"NONE"|"FRIEND"|"SENT"|"RECEIVED"|"BLOCKED"|"UNAVAILABLE"; requestId?: string; online?: boolean; blocked?: boolean }>;
export type FriendRequest = Readonly<{ id: string; person: Person; createdAt: string }>;
export type Member = Readonly<{ person: Person; owner: boolean; self: boolean }>;
export type Room = Readonly<{ id: string; kind: "DIRECT"|"GROUP"; name: string; owner: boolean; writable: boolean; muted: boolean; membershipId: string; members: readonly Member[]; invitations?: readonly {id:string;person:Person;expiresAt:string;cancellable:boolean}[] }>;
export type Invitation = Readonly<{ id: string; roomId: string; roomName: string; inviter: Person; expiresAt: string }>;
/** 15초 오목 초대는 일반 알림·그룹 초대와 분리하고 방 코드와 비밀번호를 포함하지 않는다. */
export type GomokuInvitation = Readonly<{
  id: string; roomId: number; roomTitle: string; visibility: "PUBLIC"|"PRIVATE";
  undoLimit: 1|3|5; forbiddenRule: "NONE"|"STANDARD"; inviter: Person; target: Person; expiresAt: string;
}>;
export type Notification = Readonly<{ id: string; kind: "FRIEND_REQUEST"|"FRIEND_ACCEPTED"|"GROUP_INVITATION"; targetId: string; actor: Person; createdAt: string; read: boolean }>;
export type Page<T> = Readonly<{ items: readonly T[]; page: number; pageSize: number; total: number }>;
export type Snapshot = Readonly<{ self: Person; friends: Page<Person>; received: Page<FriendRequest>; sent: Page<FriendRequest>; rooms: Page<Room>; invitations: readonly Invitation[]; notifications: Page<Notification>; unreadNotifications: number; notificationBoundary: string|null; gomokuInvitations?: readonly GomokuInvitation[]; serverTime?: string }>;
export type Summary = Readonly<{ conversationId: string; unread: number; preview?: string; nickname?: string; createdAt?: string; muted: boolean; writable: boolean }>;
export type SocialMessage = PublicChatMessage & Readonly<{ conversationId: string; publicUserId?: string }>;
export type History = Readonly<{ conversationId: string; messages: readonly SocialMessage[]; page: number; pageSize: number; total: number; writable: boolean; peerReadAt?:number }>;
export function isPerson(v: unknown): v is Person {
  return object(v)&&id(v.publicId)&&text(v.nickname,50)&&v.nickname.length>0&&isProfileAvatarId(v.avatarId)
    &&["SELF","NONE","FRIEND","SENT","RECEIVED","BLOCKED","UNAVAILABLE"].includes(v.relation as string)
    &&(v.requestId==null||id(v.requestId))&&(v.online==null||typeof v.online==="boolean")&&(v.blocked==null||typeof v.blocked==="boolean");
}
export const isRequest=(v: unknown): v is FriendRequest => object(v)&&id(v.id)&&isPerson(v.person)&&date(v.createdAt);
export function isRoom(v: unknown): v is Room {
  return object(v)&&id(v.id)&&["DIRECT","GROUP"].includes(v.kind as string)&&text(v.name,50)&&typeof v.owner==="boolean"&&typeof v.writable==="boolean"&&typeof v.muted==="boolean"&&id(v.membershipId)
    &&Array.isArray(v.members)&&v.members.length<=10&&v.members.every(m=>object(m)&&isPerson(m.person)&&typeof m.owner==="boolean"&&typeof m.self==="boolean")
    &&(v.invitations==null||Array.isArray(v.invitations)&&v.invitations.length<=9&&v.invitations.every(i=>object(i)&&id(i.id)&&isPerson(i.person)&&date(i.expiresAt)&&typeof i.cancellable==="boolean"));
}
export const isInvitation=(v: unknown): v is Invitation => object(v)&&id(v.id)&&id(v.roomId)&&text(v.roomName,50)&&isPerson(v.inviter)&&date(v.expiresAt);
export function isGomokuInvitation(v: unknown): v is GomokuInvitation {
  return object(v)&&id(v.id)&&count(v.roomId)&&v.roomId>0&&text(v.roomTitle,30)&&v.roomTitle.trim().length>0
    &&["PUBLIC","PRIVATE"].includes(v.visibility as string)&&[1,3,5].includes(v.undoLimit as number)
    &&["NONE","STANDARD"].includes(v.forbiddenRule as string)&&isPerson(v.inviter)&&isPerson(v.target)&&date(v.expiresAt);
}
export const isNotification=(v: unknown): v is Notification => object(v)&&id(v.id)&&id(v.targetId)&&["FRIEND_REQUEST","FRIEND_ACCEPTED","GROUP_INVITATION"].includes(v.kind as string)&&isPerson(v.actor)&&date(v.createdAt)&&typeof v.read==="boolean";
export function isPage<T>(v: unknown, check: (value: unknown)=>value is T): v is Page<T> {
  return object(v)&&Array.isArray(v.items)&&v.items.length<=12&&v.items.every(check)&&count(v.total)&&count(v.page)&&v.page>=1&&v.pageSize===12;
}
export function isSnapshot(v: unknown): v is Snapshot {
  return object(v)&&isPerson(v.self)&&isPage(v.friends,isPerson)&&isPage(v.received,isRequest)&&isPage(v.sent,isRequest)&&isPage(v.rooms,isRoom)
    &&isPage(v.notifications,isNotification)&&Array.isArray(v.invitations)&&v.invitations.length<=100&&v.invitations.every(isInvitation)&&count(v.unreadNotifications)&&(v.notificationBoundary===null||id(v.notificationBoundary))
    // 이전 서버의 스냅샷은 허용하되 새 초대와 시각 필드는 실제 계약을 검증한다.
    &&(v.gomokuInvitations===undefined||Array.isArray(v.gomokuInvitations)&&v.gomokuInvitations.length<=20&&v.gomokuInvitations.every(isGomokuInvitation))
    &&(v.serverTime===undefined||date(v.serverTime));
}
export const isSummary=(v: unknown): v is Summary => object(v)&&id(v.conversationId)&&count(v.unread)&&typeof v.muted==="boolean"&&typeof v.writable==="boolean"&&(v.preview==null||text(v.preview,250))&&(v.nickname==null||text(v.nickname,50))&&(v.createdAt==null||date(v.createdAt));
export function isMessage(v: unknown): v is SocialMessage {
  return object(v)&&id(v.conversationId)&&typeof v.id==="string"&&/^[a-f0-9]{24}$/.test(v.id)&&text(v.nickname,50)&&isProfileAvatarId(v.avatarId)
    &&text(v.content,2000)&&date(v.createdAt)&&typeof v.ownMessage==="boolean"&&(v.clientMessageId==null||id(v.clientMessageId))&&(v.publicUserId==null||id(v.publicUserId));
}
export function isHistory(v: unknown): v is History {
  return object(v)&&id(v.conversationId)&&Array.isArray(v.messages)&&v.messages.length<=30&&v.messages.every(isMessage)&&count(v.page)&&v.page>=1&&v.pageSize===30&&count(v.total)&&typeof v.writable==="boolean"&&(v.peerReadAt==null||count(v.peerReadAt));
}
/** 같은 허용 목록을 BFF와 클라이언트가 공유해 임의의 백엔드 경로로 프록시하지 않는다. */
export const operations = {
  snapshot: ["friendPage","requestPage","sentPage","roomPage","notificationPage","search"],
  profile: ["targetId"], "friend-request":["targetId"], "friend-accept":["requestId"], "friend-reject":["requestId"], "friend-cancel":["requestId"],
  "request-location":["requestId"],
  "friend-remove":["targetId"], block:["targetId"], unblock:["targetId"], direct:["targetId"], room:["roomId"],
  "group-create":["name","userIds"], "group-invite":["roomId","userIds"], "invitation-accept":["invitationId"], "invitation-reject":["invitationId"], "invitation-cancel":["invitationId"],
  "room-leave":["roomId"], "room-kick":["roomId","targetId"], "room-rename":["roomId","name"], "room-mute":["roomId","muted"],
  "notification-read":["notificationId"], "notifications-read":["beforeId"],
} as const;
export type Operation = keyof typeof operations;
export function isResponse(op: Operation,v: unknown) {
  return op==="snapshot"?isSnapshot(v):op==="request-location"?object(v)&&typeof v.active==="boolean"&&count(v.page)&&v.page>=1:op==="profile"||op==="friend-request"?isPerson(v):
    ["direct","group-create","room"].includes(op)?isRoom(v):op==="invitation-accept"?isRoom(v)||object(v)&&v.ok===true:object(v)&&v.ok===true;
}

