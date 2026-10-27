"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { getProfileAvatar } from "@/features/profile/catalog";
import { focusWithoutRing, showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import type { UserDetails } from "../user-contracts";
import { ROOT_ROLE_CODE } from "../contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { RefreshButton } from "./refresh-button";
import { UserActions } from "./user-actions";
import { UserPrivateDetails } from "./user-private-details";
import { UserNicknameHistory } from "./user-nickname-history";
import { displayDate, userStatus } from "./user-display";
import styles from "./admin.module.css";

// 회원 상세 메뉴는 공통 벡터 아이콘과 고정된 탭 식별자를 함께 관리한다.
const USER_DETAIL_TABS = [
  { id: "information", label: "회원 정보", icon: "user" },
  { id: "nickname", label: "닉네임 변경 이력", icon: "edit" },
  { id: "management", label: "계정 관리", icon: "gear" },
] as const;

/** 선택한 회원만 조회하고 닫기·Escape·포커스 복귀는 네이티브 모달과 기존 공통 동작을 사용한다. */
export function UserDetailsDialog({ userId, close, saved }: { userId: number; close: () => void; saved: () => void }) {
  const { sessionId } = useAdminScope();
  const details = useAdminResource<UserDetails>(sessionId, `users/${userId}`);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cleanupFocus = showModalWithoutCloseFocus(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cleanupFocus?.(); dialog?.close(); document.body.style.overflow = previousOverflow;
      // React 언마운트 뒤에는 네이티브 복귀 대상이 끊길 수 있어 연결된 회원 버튼에 직접 복귀한다.
      if (previousFocus?.isConnected) focusWithoutRing(previousFocus);
    };
  }, []);
  const reload = () => { details.reload(); saved(); };
  return <dialog ref={dialogRef} className={`${styles.dialog} ${styles.userDialog}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.userDialogTop}><div><span>MEMBER DETAILS</span><h2 id={titleId} className={styles.visuallyHidden}>회원 상세 정보</h2></div>
      <div className={styles.userDialogControls}><RefreshButton onRefresh={reload} loading={details.loading} label="회원 상세 새로고침" />
        <button type="button" className={styles.iconButton} aria-label="회원 상세 닫기" title="닫기" onClick={close}><Icon name="close" /></button>
      </div>
    </div>
    <div className={styles.userDialogBody}>
      {/* 상태 변경 직후 이전 회원 정보로 관리 폼·개인정보 조회를 다시 만들지 않고 최신 상세를 기다린다. */}
      {!details.data || details.loading ? <Loading error={details.error} retry={details.reload} />
        : <UserDetail key={`${userId}:${details.revision}`} details={details.data} reload={reload} />}
    </div>
    <div className={styles.userDialogFooter}><button type="button" onClick={close}>닫기</button></div>
  </dialog>;
}

/** 기존 회원 정보·이력·계정 관리의 권한 검사는 모달 안에서도 동일하게 유지한다. */
function UserDetail({ details, reload }: { details: UserDetails; reload: () => void }) {
  const { can, context } = useAdminScope();
  const [tab, setTab] = useState<(typeof USER_DETAIL_TABS)[number]["id"]>("information");
  const user = details.user;
  // 배정·상태 변경은 ROOT와 탈퇴·삭제 계정을 보호하고 본인의 명시적인 세션 종료만 허용한다.
  const protectedUser = user.roleCode === ROOT_ROLE_CODE;
  const manageable = !user.deleted && user.status !== "WITHDRAWN" && ((!protectedUser && (can("USER_ROLE_UPDATE") || can("USER_STATUS_UPDATE")))
    || can("USER_SESSION_REVOKE") && (!protectedUser || context.roleCode === ROOT_ROLE_CODE));
  // 실행 가능한 작업이 없는 조회 전용 사용자에게 빈 계정 관리 탭을 표시하지 않는다.
  const tabs = USER_DETAIL_TABS.filter(item => item.id !== "management" || manageable);
  const current = tab === "management" && !manageable ? "information" : tab;
  return <>
    <div className={styles.userIdentity}><div className={styles.userHeading}>
      <Image src={getProfileAvatar(user.avatarId).image} width={72} height={72} alt="" />
      <div><h2>{user.nickname}</h2><p>{user.username} · 회원 #{user.id}</p>
        <div className={styles.userBadges}><span className={styles.roleBadge}>{user.roleName}</span><span className={user.status === "ACTIVE" && !user.deleted ? styles.statusGood : styles.tag}>{userStatus(user)}</span></div>
      </div>
    </div></div>
    {/* 상세 탭에만 아이콘·선택 배경을 적용하고 다른 관리자 메뉴의 공통 탭은 유지한다. */}
    <div className={`${styles.tabs} ${styles.userDetailTabs}`} role="group" aria-label="회원 상세 메뉴">{tabs.map(item => <button key={item.id} type="button" aria-pressed={current === item.id} onClick={() => setTab(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</div>
    {current === "information" ? <><dl className={styles.userFacts}>
      <div><dt>아이디</dt><dd>{user.username}</dd></div><div><dt>닉네임</dt><dd>{user.nickname}</dd></div>
      <div><dt>가입일</dt><dd>{displayDate(user.createdAt)}</dd></div><div><dt>최근 정보 변경</dt><dd>{displayDate(user.updatedAt)}</dd></div>
    </dl><UserPrivateDetails key={`${user.id}:${user.managementVersion}`} details={details} /></>
      : current === "nickname" ? <UserNicknameHistory userId={user.id} />
        : <UserActions key={`${user.managementVersion}:${user.roleVersion}`} user={user} saved={reload} />}
  </>;
}
