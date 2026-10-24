"use client";

import { useState } from "react";
import type { NicknameChange, NumberedPage } from "../user-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { displayDate } from "./user-display";
import { NumberedPagination } from "./numbered-pagination";
import { RefreshButton } from "./refresh-button";
import styles from "./admin.module.css";

/** 회원별 저장된 변경만 최신순으로 조회한다. 관리자 편집·이력 수정·소급 생성을 제공하지 않는다. */
export function UserNicknameHistory({userId}:{userId:number}) {
  const {sessionId} = useAdminScope();
  const [page,setPage] = useState(1);
  // 회원 목록과 같은 번호 계약을 사용하며 기존 다른 관리 화면의 커서 페이징은 바꾸지 않는다.
  const search = new URLSearchParams({page:String(page),size:"10"});
  const history = useAdminResource<NumberedPage<NicknameChange>>(sessionId,`users/${userId}/nickname-history?${search}`);
  return <section>
    <div className={styles.panelHeading}><div><h3>닉네임 변경 이력</h3><p>이력 기록 기능 적용 이후 본인이 변경한 내역만 표시해요.</p></div><RefreshButton onRefresh={history.reload} loading={history.loading} label="닉네임 변경 이력 새로고침" /></div>
    {!history.data ? <Loading error={history.error} retry={history.reload} /> : history.data.items.length===0 ? <p className={styles.empty}>기록된 닉네임 변경이 없어요.</p> : <ol className={styles.nicknameHistory}>{history.data.items.map(item=><li key={item.id}>
      <div className={styles.nicknameChange}><span><small>변경 전</small><strong>{item.previousNickname}</strong></span><span aria-hidden="true">→</span><span><small>변경 후</small><strong>{item.newNickname}</strong></span></div><div className={styles.historyMeta}><time dateTime={item.changedAt}>{displayDate(item.changedAt)}</time><span className={styles.tag}>본인 변경</span></div>
    </li>)}</ol>}
    <NumberedPagination page={history.data?.page ?? page} totalPages={history.data?.totalPages ?? page} loading={history.loading || !history.data} change={setPage} label="닉네임 변경 이력 페이지 탐색" />
  </section>;
}
