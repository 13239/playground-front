import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";
import { object, uuid } from "@/features/social/contracts";
export { isMemoryInvitation, type MemoryInvitation } from "@/features/social/contracts";

/** 정답 배열 대신 현재 공개 가능한 카드만 받는다. 알 수 없는 내부 필드는 BFF에서 제거한다. */
export type Player = Readonly<{nickname:string;avatarId:ProfileAvatarId;self:boolean;ready:boolean;rematch:boolean;wins:number;losses:number}>;
export type MemoryState = Readonly<{
  roomId:number;title:string;code:string;solo:boolean;privateRoom:boolean;closed:boolean;revision:number;matchId:string|null;
  phase:"WAITING"|"PREVIEW"|"PLAYING"|"MISMATCH"|"FINISHED";serverTime:string;startedAt:string|null;deadline:string|null;finishedAt:string|null;
  seat:number;turn:number;scoreOne:number;scoreTwo:number;attempts:number;winner:number;finishReason:string|null;
  cards:readonly number[];owners:string;one:Player;two:Player|null;
}>;
export type MemoryOverview = Readonly<{
  rankings:readonly {rank:number;nickname:string;millis:number;attempts:number;achievedAt:string;self:boolean}[];
  rooms:readonly {roomId:number;title:string;privateRoom:boolean;players:number}[];
  page:number;totalPages:number;roomPage:number;roomPages:number;currentRoomId:number|null;bestMillis:number|null;rank:number|null;
}>;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const text=(v:unknown,max:number):v is string=>typeof v==="string"&&[...v].length<=max;
const date=(v:unknown):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const nullableDate=(v:unknown)=>v===null||date(v);
function isPlayer(v:unknown):v is Player{return object(v)&&text(v.nickname,50)&&isProfileAvatarId(v.avatarId)&&typeof v.self==="boolean"&&typeof v.ready==="boolean"&&typeof v.rematch==="boolean"&&integer(v.wins)&&integer(v.losses);}
export function isMemoryState(v:unknown):v is MemoryState {
  return object(v)&&integer(v.roomId,1)&&text(v.title,30)&&typeof v.code==="string"&&/^[A-Z0-9]{6}$/.test(v.code)
    &&typeof v.solo==="boolean"&&typeof v.privateRoom==="boolean"&&typeof v.closed==="boolean"&&integer(v.revision)
    &&(v.matchId===null||typeof v.matchId==="string"&&uuid.test(v.matchId))
    &&["WAITING","PREVIEW","PLAYING","MISMATCH","FINISHED"].includes(v.phase as string)&&date(v.serverTime)
    &&nullableDate(v.startedAt)&&nullableDate(v.deadline)&&nullableDate(v.finishedAt)&&integer(v.seat,0,2)&&integer(v.turn,1,2)
    &&integer(v.scoreOne,0,15)&&integer(v.scoreTwo,0,15)&&v.scoreOne+v.scoreTwo<=15&&integer(v.attempts)&&integer(v.winner,0,2)
    &&(v.finishReason===null||["COMPLETE","RESIGN","DISCONNECT","INTERRUPTED"].includes(v.finishReason as string))
    &&Array.isArray(v.cards)&&v.cards.length===30&&v.cards.every(c=>integer(c,-1,14))
    &&typeof v.owners==="string"&&/^[012]{30}$/.test(v.owners)&&isPlayer(v.one)&&(v.two===null||isPlayer(v.two));
}
export function isMemoryOverview(v:unknown):v is MemoryOverview {
  return object(v)&&integer(v.page,1)&&integer(v.totalPages,1)&&integer(v.roomPage,1)&&integer(v.roomPages,1)
    &&(v.currentRoomId===null||integer(v.currentRoomId,1))&&(v.bestMillis===null||integer(v.bestMillis))&&(v.rank===null||integer(v.rank,1))
    &&Array.isArray(v.rankings)&&v.rankings.length<=10&&v.rankings.every(r=>object(r)&&integer(r.rank,1)&&text(r.nickname,50)&&integer(r.millis)&&integer(r.attempts,15)&&date(r.achievedAt)&&typeof r.self==="boolean")
    &&Array.isArray(v.rooms)&&v.rooms.length<=10&&v.rooms.every(r=>object(r)&&integer(r.roomId,1)&&text(r.title,30)&&typeof r.privateRoom==="boolean"&&integer(r.players,1,2));
}
/** 공통 초대 응답도 검증한 상태 리터럴만 사용하고 임의 문자열을 방 이동 근거로 사용하지 않는다. */
export function isDecision(v:unknown):v is {state:"ACCEPTED"|"REJECTED"|"CANCELLED"|"EXPIRED";roomId:number|null}{return object(v)&&["ACCEPTED","REJECTED","CANCELLED","EXPIRED"].includes(v.state as string)&&(v.roomId===null||integer(v.roomId,1));}
const pickPlayer=(v:Player):Player=>({nickname:v.nickname,avatarId:v.avatarId,self:v.self,ready:v.ready,rematch:v.rematch,wins:v.wins,losses:v.losses});
export function publicMemoryState(v:MemoryState):MemoryState{return {
  roomId:v.roomId,title:v.title,code:v.code,solo:v.solo,privateRoom:v.privateRoom,closed:v.closed,revision:v.revision,matchId:v.matchId,
  phase:v.phase,serverTime:v.serverTime,startedAt:v.startedAt,deadline:v.deadline,finishedAt:v.finishedAt,seat:v.seat,turn:v.turn,
  scoreOne:v.scoreOne,scoreTwo:v.scoreTwo,attempts:v.attempts,winner:v.winner,finishReason:v.finishReason,cards:[...v.cards],owners:v.owners,
  one:pickPlayer(v.one),two:v.two?pickPlayer(v.two):null,
};}
export function publicMemoryOverview(v:MemoryOverview):MemoryOverview{return {
  page:v.page,totalPages:v.totalPages,roomPage:v.roomPage,roomPages:v.roomPages,currentRoomId:v.currentRoomId,bestMillis:v.bestMillis,rank:v.rank,
  rankings:v.rankings.map(r=>({rank:r.rank,nickname:r.nickname,millis:r.millis,attempts:r.attempts,achievedAt:r.achievedAt,self:r.self})),
  rooms:v.rooms.map(r=>({roomId:r.roomId,title:r.title,privateRoom:r.privateRoom,players:r.players})),
};}
/** 화면과 랭킹이 같은 정밀도로 기록을 표시한다. 서버의 원래 밀리초는 정렬에 그대로 사용한다. */
export function formatTime(millis:number){const value=Math.max(0,millis);return `${Math.floor(value/60000).toString().padStart(2,"0")}:${(value%60000/1000).toFixed(2).padStart(5,"0")}`;}
