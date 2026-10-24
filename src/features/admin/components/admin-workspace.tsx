"use client";

import Link from "next/link";
import { useState } from "react";
import { SessionContent } from "@/app/_components/session-content";
import { retryAuthSession } from "@/features/auth/client/session-store";
import { SiteHeader } from "@/app/_components/lobby/site-header";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import lobby from "@/app/_components/lobby/lobby.module.css";
import { useAdminAccess, invalidateAdminAccess } from "../client/use-admin-access";
import { AdminScope, Loading } from "./admin-ui";
import { RolesPanel } from "./roles-panel";
import { AccessPanel } from "./access-panel";
import { GamesPanel } from "./games-panel";
import { GenresPanel } from "./genres-panel";
import type { PermissionCode } from "../contracts";
import styles from "./admin.module.css";

const sections = [
  { key: "roles", name: "권한 관리", icon: "users", permission: "ROLE_READ", description: "역할별로 사용할 수 있는 기능을 설정하세요." },
  { key: "operations", name: "운영 설정", icon: "gear", permission: "ACCESS_POLICY_READ", description: "로그인과 기존 접속의 운영 정책을 관리하세요." },
  { key: "games", name: "게임 관리", icon: "gamepad", permission: "GAME_READ", description: "게임 정보, 플레이 모드와 공개 상태를 관리하세요." },
  { key: "genres", name: "장르 관리", icon: "grid", permission: "GAME_READ", description: "게임을 찾기 쉬운 분류로 정리하세요." },
] as const;

/** 공개 페이지 틀에는 보호 데이터를 넣지 않는다. 현재 ADMIN_ACCESS와 기능 권한이 확인된 뒤에만 패널을 연다. */
export function AdminWorkspace({ section }: { section?: string }) {
  const { auth, access } = useAdminAccess();
  // 저장 결과는 버전 변경으로 편집 폼이 교체돼도 남기되 다른 계정에는 보여 주지 않는다.
  const [savedSession, setSavedSession] = useState<string>();
  const allowed = access.status === "ready" ? sections.filter(s => access.context.permissions.includes(s.permission as PermissionCode)) : [];
  const selected = sections.find(s => s.key === (section ?? allowed[0]?.key));
  return <div className={`${lobby.screen} ${styles.screen}`}>
    <a href="#admin-main" className={lobby.skipLink}>관리자 본문으로 이동</a>
    <SiteHeader account={<SessionContent />} onNotice={() => {}} />
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.consoleLabel}><LobbyIcon name="gear" /><span>관리자 페이지</span></div>
        <nav aria-label="관리자 메뉴">{allowed.map(s => <Link key={s.key} href={`/admin/${s.key}`} prefetch={false} aria-current={selected?.key === s.key ? "page" : undefined}><LobbyIcon name={s.icon} />{s.name}</Link>)}</nav>
        <Link className={styles.backLink} href="/">← 플레이그라운드로</Link>
      </aside>
      <main id="admin-main" className={styles.main}>
        {auth.status === "anonymous" ? <div className={styles.empty}><h1>로그인이 필요해요</h1><Link href="/login">로그인하러 가기</Link></div>
          // 인증 장애를 끝없는 권한 확인으로 표시하지 않고 기존 세션 복구 절차로 재시도한다.
          : auth.status === "error" || auth.status === "authenticated" && auth.verificationError ? <Loading error={auth.status === "error" ? auth.message : auth.verificationError} retry={retryAuthSession} retryAt={auth.retryAt} pending={auth.pending} />
          : access.status === "checking" ? <Loading />
          : access.status !== "ready" ? <div className={styles.empty}><h1>{access.status === "denied" ? "관리자 페이지 접근 권한이 없어요" : "접근 권한을 확인하지 못했어요"}</h1><p>{access.message}</p>{access.status === "error" && <button onClick={invalidateAdminAccess}>다시 확인</button>}<Link href="/">홈으로 돌아가기</Link></div>
          : !selected || !allowed.some(s => s.key === selected.key) ? <div className={styles.empty}><h1>이 메뉴를 사용할 권한이 없어요</h1><p>슈퍼 관리자에게 기능 권한을 확인해 주세요.</p></div>
          : <AdminScope value={{ sessionId: access.sessionId, context: access.context, notifySaved: () => setSavedSession(access.sessionId) }}>
            <div className={styles.pageHeading}><div><span>ADMINISTRATION</span><h1>{selected.name}</h1><p>{selected.description}</p></div><span className={styles.roleBadge}>{access.context.roleName}</span></div>
            {savedSession === access.sessionId && <div className={styles.savedNotice} role="status">저장했어요.<button type="button" aria-label="저장 안내 닫기" onClick={() => setSavedSession(undefined)}>×</button></div>}
            {/* 세션별로 편집 상태를 격리해 다른 계정 로그인 후 이전 입력이 제출되지 않게 한다. */}
            <div key={`${access.sessionId}:${selected.key}`}>
              {selected.key === "roles" ? <RolesPanel /> : selected.key === "operations" ? <AccessPanel /> : selected.key === "games" ? <GamesPanel /> : <GenresPanel />}
            </div>
          </AdminScope>}
      </main>
    </div>
  </div>;
}
