"use client";

import { useState } from "react";
import { focusWithoutRing } from "@/lib/client/show-modal";
import type { ActivityLog, AuditLog, LogKind, LogOptions } from "../log-contracts";
import { defaultLogFilters, isLogDate, type LogFilters } from "../log-search";
import type { NumberedPage } from "../pagination-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { LogDetailsDialog } from "./log-details-dialog";
import { LogPersonLabel } from "./log-person";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import { RefreshButton } from "./refresh-button";
import { displayDate } from "./user-display";
import admin from "./admin.module.css";
import styles from "./logs.module.css";

/** 한 종류만 허용된 관리자에게 다른 탭이나 그 조회 요청을 만들지 않는다. */
export function LogsPanel() {
  const { can, sessionId } = useAdminScope();
  const [selected, setSelected] = useState<LogKind>();
  const tabs: readonly { kind: LogKind; label: string }[] = [
    ...(can("ACTIVITY_LOG_READ") ? [{ kind: "activities" as const, label: "사용자 활동 로그" }] : []),
    ...(can("ADMIN_AUDIT_READ") ? [{ kind: "audits" as const, label: "관리자 작업 기록" }] : []),
  ];
  const current = tabs.find(tab => tab.kind === selected)?.kind ?? tabs[0]?.kind;
  if (!current) return <p className={admin.empty}>로그 조회 권한이 없어요.</p>;
  return <LogList key={`${sessionId}:${current}`} kind={current} tabs={tabs} changeTab={setSelected} />;
}

/** 날짜·회원·종류 조건을 검색 버튼에서 함께 적용하고 표시 개수 변경은 첫 페이지로 이동한다. */
function LogList({ kind, tabs, changeTab }: { kind: LogKind; tabs: readonly { kind: LogKind; label: string }[]; changeTab: (kind: LogKind) => void }) {
  const { sessionId } = useAdminScope();
  const [draft, setDraft] = useState(defaultLogFilters);
  const [filters, setFilters] = useState<LogFilters>(draft);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [invalidDates, setInvalidDates] = useState(false);
  const [selected, setSelected] = useState<number>();
  const options = useAdminResource<LogOptions>(sessionId, `logs/${kind}/options`);
  const params = new URLSearchParams({ from: filters.from, to: filters.to, page: String(page), size: String(size) });
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.type) params.set(kind === "activities" ? "type" : "action", filters.type);
  if (kind === "activities" && filters.result) params.set("result", filters.result);
  if (kind === "audits" && filters.targetType) params.set("targetType", filters.targetType);
  const list = useAdminResource<NumberedPage<ActivityLog | AuditLog>>(sessionId, `logs/${kind}?${params}`);
  const update = (key: keyof LogFilters, value: string) => { setDraft(state => ({ ...state, [key]: value })); setInvalidDates(false); };
  const open = (id: number, row: HTMLTableRowElement) => {
    const trigger = row.querySelector<HTMLButtonElement>("button");
    if (trigger) focusWithoutRing(trigger);
    setSelected(id);
  };
  const label = kind === "activities" ? "사용자 활동 로그" : "관리자 작업 기록";
  return <section className={`${admin.panel} ${styles.panel}`} aria-label="로그 조회">
    <div className={styles.heading}><div className={`${admin.tabs} ${styles.tabs}`} role="group" aria-label="로그 종류">
      {tabs.map(tab => <button key={tab.kind} type="button" aria-pressed={kind === tab.kind} onClick={() => changeTab(tab.kind)}>{tab.label}</button>)}
    </div><RefreshButton onRefresh={list.reload} loading={list.loading} label={`${label} 새로고침`} /></div>
    <form className={styles.filters} onSubmit={event => {
      event.preventDefault();
      if (!isLogDate(draft.from) || !isLogDate(draft.to) || draft.from > draft.to) { setInvalidDates(true); return; }
      setFilters({ ...draft, query: draft.query.trim() }); setPage(1); setSelected(undefined); list.reload();
    }}>
      <fieldset className={styles.period}><legend>기간</legend><div className={styles.dates}>
        <input type="date" aria-label="조회 시작일" required min="1000-01-01" max="9999-12-30" value={draft.from} onChange={event => update("from", event.target.value)} aria-invalid={invalidDates || undefined} aria-describedby={invalidDates ? "log-date-error" : undefined} />
        <span aria-hidden="true">~</span>
        <input type="date" aria-label="조회 종료일" required min="1000-01-01" max="9999-12-30" value={draft.to} onChange={event => update("to", event.target.value)} aria-invalid={invalidDates || undefined} aria-describedby={invalidDates ? "log-date-error" : undefined} />
      </div></fieldset>
      <label className={styles.filter}><span>{kind === "activities" ? "회원" : "관리자"}</span><input type="search" aria-label={kind === "activities" ? "회원 검색" : "관리자 검색"} maxLength={100} placeholder="아이디·닉네임·회원 번호" value={draft.query} onChange={event => update("query", event.target.value)} /></label>
      <label className={styles.filter}><span>{kind === "activities" ? "활동" : "작업"}</span><select aria-label={kind === "activities" ? "활동 종류" : "작업 종류"} value={draft.type} onChange={event => update("type", event.target.value)} disabled={!options.data}>
        <option value="">{kind === "activities" ? "전체 활동" : "전체 작업"}</option>{options.data?.types.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select></label>
      <label className={styles.filter}><span>{kind === "activities" ? "결과" : "대상"}</span><select aria-label={kind === "activities" ? "활동 결과" : "대상 종류"} value={kind === "activities" ? draft.result : draft.targetType} onChange={event => update(kind === "activities" ? "result" : "targetType", event.target.value)} disabled={!options.data}>
        <option value="">{kind === "activities" ? "전체 결과" : "전체 대상"}</option>{(kind === "activities" ? options.data?.results : options.data?.targets)?.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select></label>
      <button type="submit" className={admin.primary}>검색</button>
      {/* 검색 조건은 유지하고 표시 개수 변경 시 첫 페이지와 상세 선택만 초기화한다. */}
      <PageSizeSelect className={styles.pageSize} value={size} change={next => { setSize(next); setPage(1); setSelected(undefined); }} />
    </form>
    {invalidDates && <p id="log-date-error" className={admin.error} role="alert">조회 기간의 시작일과 종료일을 확인해 주세요.</p>}
    {options.error && <Loading error={options.error} retry={options.reload} />}
    <div className={styles.tableScroll} role="region" aria-label={`${label} 그리드`} tabIndex={0} aria-busy={list.loading}>
      <table className={styles.table}><caption className={admin.visuallyHidden}>{label}. 기록 번호를 선택하면 상세 정보가 열립니다.</caption>
        <thead><tr>{(kind === "activities" ? ["기록 번호", "발생 시각", "회원", "활동", "결과", "접속 IP", "실패 사유"] : ["기록 번호", "작업 시각", "관리자", "작업 당시 권한", "작업", "대상", "변경 사유"]).map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{!list.data ? <tr><td colSpan={7}><Loading error={list.error} retry={list.reload} /></td></tr>
          : list.data.items.length === 0 ? <tr><td colSpan={7}><p className={admin.empty}>조회된 기록이 없어요.</p></td></tr>
            : list.data.items.map(entry => <tr key={entry.id} onClick={event => open(entry.id, event.currentTarget)}>
              <td><button type="button" className={styles.recordButton} aria-label={`기록 #${entry.id} 상세 보기`}>{entry.id}</button></td>
              <td><time dateTime={entry.occurredAt}>{displayDate(entry.occurredAt)}</time></td>
              {"member" in entry ? <><td><LogPersonLabel person={entry.member} /></td><td><span className={admin.roleBadge}>{entry.typeName}</span></td>
                <td><span className={entry.result === "SUCCESS" ? admin.statusGood : styles.failure}>{entry.resultName}</span></td><td className={styles.ip}>{entry.clientIp || "—"}</td><td>{entry.failureMessage || "—"}</td></>
                : <><td><LogPersonLabel person={entry.actor} system /></td><td><span className={admin.roleBadge} title={entry.actorRoleCode || "시스템"}>{entry.actorRoleName || "시스템"}</span></td>
                  <td>{entry.actionName}</td><td>{entry.targetName}</td><td>{entry.reason || "—"}</td></>}
            </tr>)}</tbody>
      </table>
    </div>
    <div className={styles.footer}><p className={admin.hint}>행을 선택하면 기록 상세 정보를 볼 수 있어요.</p>
      <NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page} loading={list.loading || !list.data} change={setPage} label={`${label} 페이지 탐색`} />
    </div>
    {selected !== undefined && <LogDetailsDialog key={`${kind}:${selected}`} kind={kind} id={selected} close={() => setSelected(undefined)} />}
  </section>;
}
