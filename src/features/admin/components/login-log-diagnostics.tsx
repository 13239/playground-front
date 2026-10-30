"use client";

import type { LoginLogDiagnostics } from "../log-contracts";
import admin from "./admin.module.css";
import styles from "./logs.module.css";

/** 같은 요청 ID로 웹 서버·인증 서버의 기록을 대조하고 실패 직전까지 통과한 단계를 확인한다. */
export function LoginLogDiagnosticsView({ value }: { value: LoginLogDiagnostics }) {
  return <section className={`${admin.inset} ${styles.loginDiagnostics}`} aria-label="로그인 진단">
    <h3>로그인 진단</h3>
    <p className={styles.diagnosticReason}>{value.reasonName}</p>
    <dl className={`${admin.userFacts} ${styles.detailsFacts}`}>
      <div><dt>기록 위치</dt><dd>{value.source}</dd></div>
      <div><dt>마지막 처리 단계</dt><dd>{value.stageName}<small className={styles.diagnosticCode}>{value.stage}</small></dd></div>
      <div className={styles.wideFact}><dt>상세 원인 코드</dt><dd className={styles.diagnosticCode}>{value.reason}</dd></div>
      <div className={styles.wideFact}><dt>로그인 요청 ID</dt><dd className={styles.diagnosticCode}>{value.attemptId}</dd></div>
      {value.context.map(attribute => <div key={attribute.label}><dt>{attribute.label}</dt><dd>{attribute.value}</dd></div>)}
    </dl>
    {value.steps.length > 0 && <><h4>단계별 처리 결과</h4><ol className={styles.loginSteps}>
      {value.steps.map((step, index) => <li key={`${index}:${step.stage}`} data-outcome={step.outcome}>
        <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
        <span className={styles.stepName}>{step.stageName}<small>{step.stage}</small></span>
        <span className={step.outcome === "FAILURE" ? styles.failure : admin.statusGood}>{step.outcome === "FAILURE" ? "실패" : "통과"}</span>
        <span className={styles.stepDuration}>{step.durationMillis.toLocaleString()} ms</span>
      </li>)}
    </ol></>}
    <p className={admin.hint}>같은 요청 ID의 기록을 함께 확인하세요. 비밀번호·해시·토큰·쿠키·예외 원문은 저장하지 않습니다.</p>
  </section>;
}
