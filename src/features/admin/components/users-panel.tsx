"use client";

import Image from "next/image";
import { useState } from "react";
import { getProfileAvatar } from "@/features/profile/catalog";
import { focusWithoutRing } from "@/lib/client/show-modal";
import { USER_PAGE_SIZES, USER_STATUS_LABELS, type AdminUser, type NumberedPage } from "../user-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { UserRoleFilter } from "./user-role-filter";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import { Select, type SelectOption } from "@/components/ui/select";
import { SearchButton, SearchInput } from "@/components/ui/search-input";
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
  // 권한 목록을 다시 조회해도 확정한 권한의 코드와 표시 이름을 함께 보존한다.
  const [role, setRole] = useState<SelectOption>();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [selected, setSelected] = useState<number>();
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("query", query.trim());
  if (status) params.set("status", status);
  if (role?.value) params.set("roleCode", role.value);
  const list = useAdminResource<NumberedPage<AdminUser>>(sessionId, `users?${params}`);
  const reset = () => { setPage(1); setSelected(undefined); };
  // 새로고침은 검색어·권한·상태·표시 개수를 처음 조건으로 되돌린 뒤 첫 페이지를 다시 조회한다.
  const refresh = () => {
    setSearch("");
    setQuery("");
    setRole(undefined);
    setStatus("");
    setSize(USER_PAGE_SIZES[0]);
    reset();
    list.reload();
  };
  const openUser = (id: number, row: HTMLTableRowElement) => {
    // 행의 빈 영역을 눌러도 닫은 뒤 해당 회원의 키보드 진입점으로 돌아온다.
    const trigger = row.querySelector<HTMLButtonElement>("button");
    if (trigger) focusWithoutRing(trigger);
    setSelected(id);
  };

  return <section className={`${styles.panel} ${styles.userGridPanel}`} aria-label="회원 목록">
    <div className={styles.panelHeading}><h2>회원 목록</h2>
      <RefreshButton onRefresh={refresh} loading={list.loading} label="회원 목록을 기본 조건으로 새로고침" />
    </div>
    <div className={styles.userToolbar}>
      <form className={styles.search} onSubmit={event => { event.preventDefault(); setQuery(search); reset(); }}>
        {/* 회원 검색과 계정 상태도 전역 입력 UI를 사용하되 기존 검색·필터 초기화를 유지한다. */}
        <SearchInput label="회원 검색" maxLength={100} placeholder="아이디·닉네임 앞부분, 회원 번호" value={search} onChange={event => setSearch(event.target.value)} />
      </form>
      {/* 권한 필터는 검색 입력이 없는 공통 선택창을 사용하고 변경 시 첫 페이지·상세 선택을 초기화한다. */}
      <UserRoleFilter selected={role} change={option => { setRole(option); reset(); }} />
      <label className={styles.userFilter}><span className={styles.visuallyHidden}>계정 상태</span>
        <Select label="계정 상태" value={status} onValueChange={value => { setStatus(value); reset(); }} options={[
          // 전체 상태에는 탈퇴를 포함하고 삭제된 계정은 서버의 공통 조회 조건에서 제외한다.
          { value: "", label: "전체 상태" }, ...Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ]} />
      </label>
      {/* 개수 선택 UI만 공통화하고 회원 목록의 첫 페이지·상세 선택 초기화는 유지한다. */}
      <div className={styles.userQueryActions}>
        <PageSizeSelect sizes={USER_PAGE_SIZES} value={size} change={next => { setSize(next); reset(); }} />
        {/* 돋보기는 확정된 검색어·권한·상태·표시 개수·페이지를 유지하고 현재 목록만 다시 조회한다. */}
        <SearchButton type="button" className={styles.userQueryButton} label="현재 필터로 회원 목록 재조회"
          onClick={list.reload} disabled={list.loading} aria-busy={list.loading} />
      </div>
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
