import "server-only";
import { isPerson, isRoom, isSnapshot, type Person, type Room, type Page, type GomokuInvitation, type MemoryInvitation } from "../contracts";

/** 응답에 새 내부 필드가 생겨도 브라우저에는 명시한 공개 필드만 전달한다. */
function person(value: Person): Person {
  return {
    publicId: value.publicId, nickname: value.nickname, avatarId: value.avatarId, relation: value.relation,
    ...(value.requestId ? { requestId: value.requestId } : {}),
    ...(value.online !== undefined ? { online: value.online } : {}),
    ...(value.blocked !== undefined ? { blocked: value.blocked } : {}),
  };
}

/** 새 카드 게임 초대도 명시적인 공개 필드만 복사한다. */
export function publicMemoryInvitation(value:MemoryInvitation):MemoryInvitation {
  return {id:value.id,roomId:value.roomId,roomTitle:value.roomTitle,inviter:person(value.inviter),target:person(value.target),expiresAt:value.expiresAt};
}

/** 오목 초대도 중첩 회원 엔티티·향후 서버 필드를 전개하지 않고 허용한 공개 값만 복사한다. */
export function publicGomokuInvitation(value: GomokuInvitation): GomokuInvitation {
  return {id:value.id,roomId:value.roomId,roomTitle:value.roomTitle,visibility:value.visibility,
    undoLimit:value.undoLimit,forbiddenRule:value.forbiddenRule,inviter:person(value.inviter),target:person(value.target),expiresAt:value.expiresAt};
}

function page<T, R>(value: Page<T>, copy: (item: T) => R): Page<R> {
  return { items: value.items.map(copy), page: value.page, pageSize: value.pageSize, total: value.total };
}

function room(value: Room): Room {
  return {
    id: value.id, kind: value.kind, name: value.name, owner: value.owner, writable: value.writable,
    muted: value.muted, membershipId: value.membershipId,
    members: value.members.map(member => ({ person: person(member.person), owner: member.owner, self: member.self })),
    invitations: value.invitations?.map(invite => ({
      id: invite.id, person: person(invite.person), expiresAt: invite.expiresAt, cancellable: invite.cancellable,
    })) ?? [],
  };
}

/** 호출자가 응답 검증을 마친 뒤 DTO 전체를 펼치지 않고 허용 목록으로 복사한다. */
export function publicSocialResponse(value: unknown): object {
  if (isSnapshot(value)) return {
    self: person(value.self), friends: page(value.friends, person),
    received: page(value.received, request => ({ id: request.id, person: person(request.person), createdAt: request.createdAt })),
    sent: page(value.sent, request => ({ id: request.id, person: person(request.person), createdAt: request.createdAt })),
    rooms: page(value.rooms, room),
    invitations: value.invitations.map(invite => ({
      id: invite.id, roomId: invite.roomId, roomName: invite.roomName, inviter: person(invite.inviter), expiresAt: invite.expiresAt,
    })),
    notifications: page(value.notifications, notification => ({
      id: notification.id, kind: notification.kind, targetId: notification.targetId, actor: person(notification.actor),
      createdAt: notification.createdAt, read: notification.read,
    })),
    unreadNotifications: value.unreadNotifications, notificationBoundary: value.notificationBoundary,
    gomokuInvitations: value.gomokuInvitations?.map(publicGomokuInvitation) ?? [],
    memoryInvitations: value.memoryInvitations?.map(publicMemoryInvitation) ?? [],
    ...(value.serverTime ? {serverTime:value.serverTime} : {}),
  };
  if (isPerson(value)) return person(value);
  if (isRoom(value)) return room(value);
  if (value && typeof value === "object" && "active" in value && "page" in value) {
    return { active: value.active, page: value.page };
  }
  return { ok: true };
}
