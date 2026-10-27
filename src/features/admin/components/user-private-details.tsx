"use client";

import type { UserDetails, UserSensitive } from "../user-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

/** 허용된 관리자는 개인정보 원문을 바로 조회한다. 사유·마스킹·자동 숨김 없이 모달 메모리에만 보관한다. */
export function UserPrivateDetails({ details }: { details: UserDetails }) {
  const { sessionId, can } = useAdminScope();
  // 탈퇴 여부를 상태 코드로 분리해도 원문 개인정보 조회 제한은 그대로 유지한다.
  const permitted = can("USER_SENSITIVE_READ") && !details.user.deleted && details.user.status !== "WITHDRAWN";
  const resource = useAdminResource<UserSensitive>(sessionId, permitted ? `users/${details.user.id}/sensitive` : "");
  if (!permitted) return null;
  const value = resource.data;
  return <section className={styles.inset} aria-label="개인정보">
    <h3>개인정보</h3>
    {!value ? <Loading error={resource.error} retry={resource.reload} /> : <dl className={styles.userFacts}>
      <div><dt>이메일</dt><dd>{value.email || "미등록"}</dd></div>
      <div><dt>연락처</dt><dd>{value.phone || "미등록"}</dd></div>
      <div><dt>생년월일</dt><dd>{value.birthday || "미등록"}</dd></div>
      <div><dt>성별</dt><dd>{value.gender === "M" ? "남성" : value.gender === "F" ? "여성" : "미등록"}</dd></div>
    </dl>}
  </section>;
}
