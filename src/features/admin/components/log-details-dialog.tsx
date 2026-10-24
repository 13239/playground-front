"use client";

import { useEffect, useId, useRef } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { focusWithoutRing, showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import type { ActivityLogDetails, AuditLogDetails, LogDetails, LogKind } from "../log-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { LogPersonLabel } from "./log-person";
import { displayDate } from "./user-display";
import admin from "./admin.module.css";
import styles from "./logs.module.css";

/** 선택한 한 기록만 읽고 닫을 때 초점·스크롤과 상세 메모리를 원래 상태로 돌린다. */
export function LogDetailsDialog({ kind, id, close }: { kind: LogKind; id: number; close: () => void }) {
  const { sessionId } = useAdminScope();
  const resource = useAdminResource<LogDetails>(sessionId, `logs/${kind}/${id}`);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const title = kind === "activities" ? "활동 로그 상세" : "작업 기록 상세";
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cleanupFocus = showModalWithoutCloseFocus(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cleanupFocus?.(); dialog?.close(); document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) focusWithoutRing(previousFocus);
    };
  }, []);
  const data = resource.data;
  return <dialog ref={ref} className={`${admin.dialog} ${admin.userDialog}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <div className={`${admin.userDialogTop} ${styles.detailHeader}`}><div className={styles.detailTitle}>
      <span>{kind === "activities" ? "ACTIVITY LOG" : "ADMINISTRATOR LOG"}</span><h2 id={titleId}>{title}</h2>
      {data && <p className={styles.detailSubtitle}>{"changes" in data ? data.entry.actionName : data.entry.typeName} · 기록 #{id}</p>}
    </div><button type="button" className={admin.iconButton} aria-label={`${title} 닫기`} title="닫기" onClick={close}><LobbyIcon name="close" /></button></div>
    <div className={admin.userDialogBody}>
      {!data ? <Loading error={resource.error} retry={resource.reload} /> : "changes" in data ? <AuditDetails value={data} /> : <ActivityDetails value={data} />}
    </div>
    <div className={admin.userDialogFooter}><button type="button" onClick={close}>닫기</button></div>
  </dialog>;
}

/** 브라우저 문자열·오류 문구·입력 당시 식별자도 HTML로 해석하지 않고 텍스트로 표시한다. */
function ActivityDetails({ value }: { value: ActivityLogDetails }) {
  const { entry } = value;
  return <dl className={`${admin.userFacts} ${styles.detailsFacts}`}>
    <div><dt>발생 시각</dt><dd>{displayDate(entry.occurredAt)}</dd></div>
    <div><dt>회원</dt><dd><LogPersonLabel person={entry.member} /></dd></div>
    <div><dt>활동</dt><dd>{entry.typeName}</dd></div>
    <div><dt>결과</dt><dd><span className={entry.result === "SUCCESS" ? admin.statusGood : styles.failure}>{entry.resultName}</span></dd></div>
    <div><dt>접속 IP</dt><dd>{entry.clientIp || "—"}</dd></div>
    <div><dt>실패 사유</dt><dd>{entry.failureMessage || "—"}</dd></div>
    {entry.failureCode && <div className={styles.wideFact}><dt>실패 코드</dt><dd>{entry.failureCode}</dd></div>}
    <div className={styles.wideFact}><dt>브라우저 정보</dt><dd>{value.userAgent || "—"}</dd></div>
    {value.attributes.map(attribute => <div key={attribute.label}><dt>{attribute.label}</dt><dd>{attribute.value}</dd></div>)}
  </dl>;
}

/** 저장된 스냅샷을 비교한다. 현재 데이터로 과거 변경을 추정하거나 수정 입력을 제공하지 않는다. */
function AuditDetails({ value }: { value: AuditLogDetails }) {
  const { entry } = value;
  return <>
    <dl className={`${admin.userFacts} ${styles.detailsFacts}`}>
      <div><dt>작업 시각</dt><dd>{displayDate(entry.occurredAt)}</dd></div>
      <div><dt>작업 관리자</dt><dd><LogPersonLabel person={entry.actor} system /></dd></div>
      <div><dt>작업 당시 권한</dt><dd>{entry.actorRoleName || "시스템"}{entry.actorRoleCode && <small className={styles.roleCode}>{entry.actorRoleCode}</small>}</dd></div>
      <div><dt>대상</dt><dd>{entry.targetName}</dd></div>
    </dl>
    <section className={`${admin.inset} ${styles.detailSection}`}><h3>변경 내용</h3>
      {value.changes.length ? <div className={styles.comparison}><table><caption className={admin.visuallyHidden}>저장된 변경 전·후 비교</caption>
        <thead><tr><th scope="col">항목</th><th scope="col">변경 전</th><th scope="col">변경 후</th></tr></thead>
        <tbody>{value.changes.map(change => <tr key={change.label}><th scope="row">{change.label}</th><td>{change.before ?? "—"}</td><td>{change.after ?? "—"}</td></tr>)}</tbody>
      </table></div> : <p className={admin.hint}>이 작업에는 변경 전·후 값이 기록되지 않았어요.</p>}
    </section>
    {value.attributes.length > 0 && <dl className={admin.userFacts}>{value.attributes.map(attribute => <div key={attribute.label}><dt>{attribute.label}</dt><dd>{attribute.value}</dd></div>)}</dl>}
    <section className={`${admin.inset} ${styles.detailSection}`}><h3>변경 사유</h3><p className={styles.savedReason}>{entry.reason || "—"}</p></section>
  </>;
}
