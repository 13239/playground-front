"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { getProfileAvatar } from "@/features/profile/catalog";
import { focusWithoutRing } from "@/lib/client/show-modal";
import { USER_PAGE_SIZES, type AdminUser, type NumberedPage } from "../user-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { CodePicker } from "./code-picker";
import { NumberedPagination } from "./numbered-pagination";
import { RefreshButton } from "./refresh-button";
import { UserDetailsDialog } from "./user-details-dialog";
import { displayDate, userStatus } from "./user-display";
import styles from "./admin.module.css";

/** 검색 조건·번호 페이지·선택 회원을 관리한다. 목록에는 개인정보 원문이나 전체 회원 수 표시를 추가하지 않는다. */
export function UsersPanel() {
  const { sessionId } = useAdminScope();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [selected, setSelected] = useState<number>();
  const roleFilter = useRef<HTMLDetailsElement>(null);
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("query", query.trim());
  if (status) params.set("status", status);
  if (role) params.set("roleCode", role);
  const list = useAdminResource<NumberedPage<AdminUser>>(sessionId, `users?${params}`);
  const reset = () => { setPage(1); setSelected(undefined); };
  const openUser = (id: number, row: HTMLTableRowElement) => {
    // 행의 빈 영역을 눌러도 닫은 뒤 해당 회원의 키보드 진입점으로 돌아온다.
    const trigger = row.querySelector<HTMLButtonElement>("button");
    if (trigger) focusWithoutRing(trigger);
    setSelected(id);
  };

  return <section className={`${styles.panel} ${styles.userGridPanel}`} aria-label="회원 목록">
    <div className={styles.panelHeading}><h2>회원 목록</h2>
      <RefreshButton onRefresh={list.reload} loading={list.loading} label="회원 목록 새로고침" />
    </div>
    <div className={styles.userToolbar}>
      <form className={styles.search} data-focus-frame onSubmit={event => { event.preventDefault(); setQuery(search); reset(); }}>
        <input type="search" maxLength={100} aria-label="회원 검색" placeholder="아이디·닉네임 앞부분, 회원 번호"
          value={search} onChange={event => setSearch(event.target.value)} /><button type="submit">검색</button>
      </form>
      <details ref={roleFilter} className={styles.userRoleFilter}>
        <summary>{role || "전체 권한"}</summary>
        <div className={styles.userRolePopover}><CodePicker area="users/role-options" label="권한" selected={role ? [role] : []} single
          change={codes => { setRole(codes.at(-1) ?? ""); reset(); if (roleFilter.current) roleFilter.current.open = false; }} /></div>
      </details>
      <label className={styles.userFilter}><span className={styles.visuallyHidden}>계정 상태</span>
        <select aria-label="계정 상태" value={status} onChange={event => { setStatus(event.target.value); reset(); }}>
          <option value="">전체 상태 (탈퇴 제외)</option><option value="ACTIVE">활성</option><option value="INACTIVE">비활성</option><option value="PENDING">가입대기</option><option value="DELETED">탈퇴</option>
        </select>
      </label>
      <label className={`${styles.userFilter} ${styles.userPageSize}`}><span className={styles.visuallyHidden}>페이지당 표시 개수</span>
        <select aria-label="페이지당 표시 개수" value={size} onChange={event => { setSize(Number(event.target.value)); reset(); }}>
          {USER_PAGE_SIZES.map(value => <option key={value} value={value}>{value}개씩</option>)}
        </select>
      </label>
    </div>
    <div className={styles.userTableScroll} role="region" aria-label="회원 목록 그리드" tabIndex={0} aria-busy={list.loading}>
      <table className={styles.userTable}>
        <caption className={styles.visuallyHidden}>회원 목록. 닉네임을 선택하면 상세 정보가 열립니다.</caption>
        <thead><tr><th scope="col">회원 번호</th><th scope="col">닉네임</th><th scope="col">아이디</th><th scope="col">권한</th><th scope="col">계정 상태</th><th scope="col">가입일</th><th scope="col">최근 정보 변경</th></tr></thead>
        <tbody>{!list.data ? <tr><td colSpan={7}><Loading error={list.error} retry={list.reload} /></td></tr>
          : list.data.items.length === 0 ? <tr><td colSpan={7}><p className={styles.empty}>검색 결과가 없어요.</p></td></tr>
          : list.data.items.map(user => <tr key={user.id} onClick={event => openUser(user.id, event.currentTarget)}>
            <td>{user.id}</td>
            <td><button type="button" className={styles.userOpenButton} aria-label={`${user.nickname} 회원 상세 보기`}>
              <Image src={getProfileAvatar(user.avatarId).image} alt="" width={38} height={38} /><strong>{user.nickname}</strong>
            </button></td>
            <td>{user.username}</td><td><span className={styles.roleBadge}>{user.roleName}</span></td>
            <td><span className={user.status === "ACTIVE" && !user.deleted ? styles.statusGood : styles.tag}>{userStatus(user)}</span></td>
            <td><time dateTime={user.createdAt}>{displayDate(user.createdAt)}</time></td><td>{displayDate(user.updatedAt)}</td>
          </tr>)}</tbody>
      </table>
    </div>
    <div className={styles.userGridFooter}>
      <p className={styles.hint}>행을 선택하면 회원 상세 정보를 볼 수 있어요.</p>
      <NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page}
        loading={list.loading || !list.data} change={setPage} label="회원 목록 페이지 탐색" />
    </div>
    {selected !== undefined && <UserDetailsDialog key={`${sessionId}:${selected}`} userId={selected}
      close={() => setSelected(undefined)} saved={list.reload} />}
  </section>;
}
