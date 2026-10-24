"use client";

import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { displayChatDate } from "../chat-contracts";
import { monitoringDate, type ServiceState, type ServiceStatuses } from "../monitoring-contracts";
import { useMonitoringResource } from "../client/use-monitoring-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { RefreshButton } from "./refresh-button";
import admin from "./admin.module.css";
import styles from "./monitoring.module.css";

const services = [{ code: "LOGIN", name: "로그인", description: "로그인 및 세션 확인", icon: "shield" },
  { code: "GAME", name: "게임", description: "게임 목록 및 입장 확인", icon: "gamepad" },
  { code: "CHAT", name: "채팅", description: "채팅 연결 및 저장 확인", icon: "chat" }] as const;
const states = { NORMAL: { label: "정상", icon: "check" }, DELAYED: { label: "지연", icon: "clock" }, DOWN: { label: "장애", icon: "close" }, UNKNOWN: { label: "확인 불가", icon: "question" } } as const;

/** 서비스 연결 확인 결과만 읽는다. 서버 제어·상세 진단·관리 명령을 브라우저에 노출하지 않는다. */
export function ServiceStatusPanel() {
  const { can, sessionId } = useAdminScope();
  return can("SERVICE_STATUS_READ") ? <ServiceStatusContent key={sessionId} /> : <p className={admin.empty}>서비스 상태 조회 권한이 없어요.</p>;
}
function ServiceStatusContent() {
  const { sessionId } = useAdminScope();
  const resource = useMonitoringResource<ServiceStatuses>(sessionId, "service-status");
  const data = resource.data;
  const latest = data?.services.map(service => service.checkedAt).filter((at): at is string => at !== null).sort().at(-1);
  return <section className={`${admin.panel} ${styles.panel}`} aria-label="서비스 확인" aria-busy={resource.loading}>
    <div className={styles.serviceHeading}><div><h2>서비스 확인</h2><p className={styles.updated}>마지막 확인 {latest ? displayChatDate(latest).slice(11) : "—"}</p></div>
      <div className={styles.chartControls}>{data && <span className={styles.dateLine}>{monitoringDate(data.checkedAt)} · KST</span>}<RefreshButton label="서비스 상태 새로고침" onRefresh={resource.reload} loading={resource.loading} /></div></div>
    {!data ? <Loading error={resource.error} retry={resource.reload} /> : <>
      <div className={styles.serviceTableWrap}><table className={styles.serviceTable} role="table"><caption className={admin.visuallyHidden}>로그인·게임·채팅의 운영 연결 확인 상태</caption><thead><tr><th scope="col">서비스</th><th scope="col">상태</th><th scope="col">확인 항목</th><th scope="col">마지막 확인</th></tr></thead>
        <tbody>{services.map(service => { const status = data.services.find(value => value.code === service.code)!; return <tr key={service.code}>
          <th scope="row"><span className={styles.serviceName}><span className={styles.serviceIcon}><LobbyIcon name={service.icon} /></span>{service.name}</span></th>
          <td><StatusBadge state={status.state} /></td><td className={styles.serviceDescription}>{service.description}</td><td className={styles.serviceTime}>{status.checkedAt ? <time dateTime={status.checkedAt}>{displayChatDate(status.checkedAt)}</time> : "아직 확인하지 않았어요"}</td>
        </tr>; })}</tbody></table></div>
      <div className={styles.statusLegend} aria-label="서비스 상태 범례">{(Object.keys(states) as ServiceState[]).map(state => <StatusBadge key={state} state={state} />)}</div>
      <p className={styles.graphHint}>30초 간격으로 서비스 처리에 필요한 연결 상태를 확인해요.</p>
    </>}
  </section>;
}
function StatusBadge({ state }: { state: ServiceState }) { return <span className={`${styles.statusBadge} ${styles[state.toLowerCase()]}`}><LobbyIcon name={states[state].icon} />{states[state].label}</span>; }
