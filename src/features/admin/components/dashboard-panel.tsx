"use client";

import { useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { displayChatDate } from "../chat-contracts";
import { metricNumber, monitoringDate, type Dashboard, type DashboardPeriod } from "../monitoring-contracts";
import { useMonitoringResource } from "../client/use-monitoring-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { RefreshButton } from "./refresh-button";
import { ConnectionChart } from "./connection-chart";
import admin from "./admin.module.css";
import styles from "./monitoring.module.css";

/** 승인된 두 지표와 접속 그래프만 제공한다. 실데이터 화면에는 시안의 예시 수치를 넣지 않는다. */
export function DashboardPanel() {
  const { can, sessionId } = useAdminScope();
  return can("DASHBOARD_READ") ? <DashboardContent key={sessionId} /> : <p className={admin.empty}>대시보드 조회 권한이 없어요.</p>;
}
function DashboardContent() {
  const { sessionId } = useAdminScope();
  const [period, setPeriod] = useState<DashboardPeriod>("TODAY");
  const resource = useMonitoringResource<Dashboard>(sessionId, `dashboard?period=${period}`);
  const data = resource.data;
  const loadingLabel = resource.error ? "확인 불가" : "불러오는 중";
  return <section className={`${admin.panel} ${styles.panel}`} aria-label="운영 대시보드" aria-busy={resource.loading}>
    <div className={styles.dateLine}>{data ? `${monitoringDate(data.checkedAt)} · KST` : "KST"}</div>
      <div className={styles.metrics}>
        <div className={styles.metric}><span className={styles.metricIcon}><LobbyIcon name="users" /></span><div><h2>현재 접속</h2><p className={styles.metricValue}>{data?.onlineState === "READY" && data.onlineCount !== null ? <>{metricNumber(data.onlineCount)}<small>명</small></> : <span>{!data ? loadingLabel : data.onlineState === "COLLECTING" ? "집계 중" : "확인 불가"}</span>}</p><p className={styles.metricHint}>최근 60초 접속 확인 · 회원 중복 제외</p></div></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.mint}`}><LobbyIcon name="userPlus" /></span><div><h2>오늘 신규회원</h2><p className={styles.metricValue}>{data && data.newMembers !== null ? <>{metricNumber(data.newMembers)}<small>명</small></> : <span>{!data ? loadingLabel : "확인 불가"}</span>}</p><p className={styles.metricHint}>오늘 가입한 회원 · KST 기준</p></div></div>
      </div>
      {/* 조회 중에도 조작부를 유지해 기간 전환의 키보드 초점과 카드 배치가 끊기지 않게 한다. */}
      <div className={styles.chartCard}><div className={styles.chartHeading}><h2>접속 현황</h2><div className={styles.chartControls}>
        <div className={styles.segmented} role="group" aria-label="접속 현황 기간">{([['TODAY','오늘'],['WEEK','7일'],['MONTH','30일']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
        <RefreshButton label="대시보드 새로고침" loading={resource.loading} onRefresh={resource.reload} />
      </div></div>
      {!data ? <Loading error={resource.error} retry={resource.reload} /> : <>
        <p className={styles.updated}>마지막 수집 {data.historyCheckedAt ? displayChatDate(data.historyCheckedAt) : "—"} · {period === "TODAY" ? "시간별" : "일별"} 최대 동시 접속</p>
        {data.historyState !== "READY" && <p className={styles.dataNotice} role="status">{data.historyState === "COLLECTING" ? "접속 기록을 수집하고 있어요. 수집 이전 구간은 비워서 표시해요." : data.historyState === "DELAYED" ? "접속 집계가 지연되고 있어요. 마지막으로 수집된 기록을 표시해요." : "접속 기록을 확인하지 못했어요. 잠시 후 다시 확인해 주세요."}</p>}
        <ConnectionChart points={data.points} hourly={period === "TODAY"} />
        <p className={styles.graphHint}>수집된 구간의 최대값이에요. 기록이 없는 구간은 연결하지 않아요.</p>
      </>}
      </div>
  </section>;
}
