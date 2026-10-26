"use client";

import { useState } from "react";
import type { AdminUser } from "../user-contracts";
import { ROOT_ROLE_CODE } from "../contracts";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { CodePicker } from "./code-picker";
import { ConfirmDialog, Feedback, Field, formText, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

/** 업무별 기능 권한을 구분하고 실행 전에 대상·행동을 확인한다. 본인/최고 관리자 보호는 서버도 강제한다. */
export function UserActions({user,saved}:{user:AdminUser;saved:()=>void}) {
  const {can,context} = useAdminScope();
  const mutation = useAdminMutation();
  const [role,setRole] = useState(user.roleCode);
  const [pending,setPending] = useState<{title:string;message:string;path:string;method:"PUT"|"POST";body:object;logout?:boolean}>();
  // ROOT는 일반 권한 배정이나 계정 상태 변경으로 만들거나 해제할 수 없다.
  const protectedUser = user.roleCode===ROOT_ROLE_CODE;
  if(user.deleted)return <p className={styles.empty}>탈퇴한 회원은 변경할 수 없어요.</p>;
  return <div className={styles.stack}>
    {can("USER_ROLE_UPDATE")&&!protectedUser&&<section className={styles.inset}><h3>권한 배정</h3><p className={styles.hint}>권한을 변경하면 기존 로그인이 종료되고 다시 로그인해야 해요.</p>
      <form onSubmit={e=>{e.preventDefault();if(role===user.roleCode||!role||mutation.busy)return;const reason=formText(new FormData(e.currentTarget),"reason");setPending({title:"회원의 권한을 변경할까요?",message:`${user.username} 회원에게 ${role} 권한을 배정하고 기존 로그인을 종료해요.`,path:`users/${user.id}/role`,method:"PUT",body:{roleCode:role,expectedVersion:user.roleVersion,reason}});}}>
        <CodePicker area="users/role-options" label="배정할 권한" single selected={role?[role]:[]} change={codes=>setRole(codes.at(-1)??"")} exclude={[ROOT_ROLE_CODE]} disabled={mutation.busy} />
        <ActionReason disabled={mutation.busy}/><div className={styles.actions}><button className={styles.primary} disabled={mutation.busy||!role||role===user.roleCode}>권한 변경</button></div>
      </form></section>}
    {can("USER_STATUS_UPDATE")&&!protectedUser&&<section className={styles.inset}><h3>계정 상태</h3>
      <form onSubmit={e=>{e.preventDefault();if(mutation.busy)return;const form=new FormData(e.currentTarget);const status=formText(form,"status");setPending({title:status==="INACTIVE"?"계정을 비활성화할까요?":"계정을 활성화할까요?",message:status==="INACTIVE"?`${user.username} 회원의 기존 로그인이 종료되고 새 로그인이 차단돼요.`:`${user.username} 회원의 새 로그인을 허용해요. 종료된 세션은 복원되지 않아요.`,path:`users/${user.id}/status`,method:"PUT",body:{status,expectedVersion:user.managementVersion,reason:formText(form,"reason")}});}}>
        <Field label="변경할 상태"><select name="status" defaultValue={user.status==="INACTIVE"||user.id===context.userId?"ACTIVE":"INACTIVE"} disabled={mutation.busy}><option value="ACTIVE">활성</option><option value="INACTIVE" disabled={user.id===context.userId}>비활성</option></select></Field>
        <ActionReason disabled={mutation.busy}/><div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>상태 변경</button></div>
      </form></section>}
    {can("USER_SESSION_REVOKE")&&(!protectedUser||context.roleCode===ROOT_ROLE_CODE)&&<section className={styles.inset}><h3>강제 로그아웃</h3><p className={styles.hint}>이 회원의 모든 로그인 세션을 종료해요. 계정 상태는 바뀌지 않아요.</p>
      <form onSubmit={e=>{e.preventDefault();if(mutation.busy)return;setPending({title:"모든 기기에서 로그아웃시킬까요?",message:`${user.username} 회원의 현재 로그인이 모두 종료돼요.`,path:`users/${user.id}/sessions/revoke`,method:"POST",body:{expectedVersion:user.managementVersion,reason:formText(new FormData(e.currentTarget),"reason")},logout:user.id===context.userId});}}><ActionReason disabled={mutation.busy}/><div className={styles.actions}><button type="submit" className={styles.danger} disabled={mutation.busy}>모든 로그인 종료</button></div></form>
    </section>}
    {!can("USER_ROLE_UPDATE")&&!can("USER_STATUS_UPDATE")&&!can("USER_SESSION_REVOKE")&&<p className={styles.empty}>계정 관리 기능을 사용할 권한이 없어요.</p>}
    {protectedUser&&<p className={styles.hint}>ROOT 계정의 권한과 상태는 변경할 수 없어요.</p>}
    <Feedback error={mutation.error} success={mutation.success}/>
    {pending&&<ConfirmDialog title={pending.title} close={()=>setPending(undefined)} confirm={()=>void mutation.run(pending.path,pending.method,pending.body,()=>{if(pending.logout)revalidateAuthSession();else saved();})}><p>{pending.message}</p></ConfirmDialog>}
  </div>;
}
function ActionReason({disabled}:{disabled:boolean}) {
  const [invalid,setInvalid]=useState(false);
  return <Field label="변경 사유"><input name="reason" maxLength={300} required pattern=".*\S.*" disabled={disabled} aria-invalid={invalid||undefined} onInvalid={()=>setInvalid(true)} onChange={e=>{if(e.currentTarget.validity.valid)setInvalid(false);}} placeholder="운영 기록에 남길 사유를 입력하세요" /></Field>;
}
