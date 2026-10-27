"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { NICKNAME_HISTORY_PAGE_SIZES, type NicknameChange, type NumberedPage } from "../user-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { displayDate } from "./user-display";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import { RefreshButton } from "./refresh-button";
import styles from "./user-nickname-history.module.css";

/** 회원별 저장된 변경만 최신순으로 조회한다. 관리자 편집·이력 수정·소급 생성을 제공하지 않는다. */
export function UserNicknameHistory({ userId }: { userId: number }) {
  const { sessionId } = useAdminScope();
  const [page, setPage] = useState(1);
  // 이력 전용 표시 개수는 10개를 기본으로 하고 변경할 때 첫 페이지부터 다시 조회한다.
  const [size, setSize] = useState<number>(NICKNAME_HISTORY_PAGE_SIZES[0]);
  // 회원 목록과 같은 번호 계약을 사용하며 기존 다른 관리 화면의 커서 페이징은 바꾸지 않는다.
  const search = new URLSearchParams({ page: String(page), size: String(size) });
  const history = useAdminResource<NumberedPage<NicknameChange>>(sessionId, `users/${userId}/nickname-history?${search}`);
  // 서버가 보정한 페이지 번호를 최신 강조와 공통 페이지네이션에 함께 사용한다.
  const currentPage = history.data?.page ?? page;

  return (
    <section className={styles.root} aria-label="닉네임 변경 이력">
      <div className={styles.heading}>
        <div><h3>닉네임 변경 이력</h3><p>지금까지 변경한 닉네임의 이력을 확인할 수 있습니다.</p></div>
        <RefreshButton onRefresh={history.reload} loading={history.loading} label="닉네임 변경 이력 새로고침" />
      </div>
      <div className={styles.panel}>
        <div aria-busy={history.loading}>
          {!history.data ? <Loading error={history.error} retry={history.reload} />
            : history.data.items.length === 0 ? <p className={styles.empty}>기록된 닉네임 변경이 없어요.</p>
              : <>
                {/* 같은 이력을 넓은 화면에서는 열로, 좁은 컨테이너에서는 레이블이 있는 카드로 배치한다. */}
                <div className={styles.columns} aria-hidden="true">
                  <span>변경 전 닉네임</span><span /><span>변경 후 닉네임</span><span>변경일시</span><span>변경 주체</span>
                </div>
                {/* 목록 기호를 숨겨도 Safari의 읽기 도구에 목록 의미가 유지되도록 역할을 명시한다. */}
                <ol className={styles.list} role="list">
                  {history.data.items.map((item, index) => (
                    <li key={item.id} className={styles.row} data-latest={currentPage === 1 && index === 0}>
                      <div className={styles.nicknameCell}>
                        <span className={styles.cellLabel}>변경 전 닉네임</span>
                        <strong className={styles.previousNickname}>{item.previousNickname}</strong>
                      </div>
                      <Icon name="arrow" className={styles.arrow} />
                      <div className={styles.nicknameCell}>
                        <span className={styles.cellLabel}>변경 후 닉네임</span>
                        <strong className={styles.newNickname}>{item.newNickname}</strong>
                      </div>
                      <div className={styles.changedAt}>
                        <span className={styles.cellLabel}>변경일시</span>
                        <time dateTime={item.changedAt}>{displayDate(item.changedAt)}</time>
                      </div>
                      <div className={styles.actor}>
                        <span className={styles.cellLabel}>변경 주체</span><span className={styles.actorBadge}>본인</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </>}
        </div>
        {/* 개수 선택·번호 이동·새로고침은 기존 공통 UI와 인증된 조회 경로를 재사용한다. */}
        <div className={styles.footer}>
          <p className={styles.total} role="status">총 <strong>{history.data ? history.data.totalElements.toLocaleString("ko-KR") : "—"}</strong>건</p>
          <NumberedPagination page={currentPage} totalPages={history.data?.totalPages ?? page}
            loading={history.loading || !history.data} change={setPage} label="닉네임 변경 이력 페이지 탐색" />
          <PageSizeSelect className={styles.pageSize} sizes={NICKNAME_HISTORY_PAGE_SIZES} value={size}
            change={next => { setSize(next); setPage(1); }} />
        </div>
      </div>
    </section>
  );
}
