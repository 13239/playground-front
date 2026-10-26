"use client";

import { useEffect, useState } from "react";
import { RolesPanel } from "@/features/admin/components/roles-panel";
import { PageSizeSelect } from "@/features/admin/components/page-size-select";
import { CatalogDialog } from "@/features/admin/components/catalog-dialog";
import { AdminScope } from "@/features/admin/components/admin-ui";
import { permissionCodes } from "@/features/admin/contracts";
import { FILTER_PAGE_SIZES } from "@/features/admin/filter-contracts";
import { getBrowserKey } from "@/features/auth/client/browser-key";
import styles from "@/features/admin/components/admin.module.css";

/** 실제 권한 그리드와 공통 선택창의 입력·배치만 검증하며 모든 관리 요청은 메모리에서 응답한다. */
export default function SelectVerification() {
  const [ready, setReady] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [size, setSize] = useState(10);
  const [filterSize, setFilterSize] = useState(20);
  const [submits, setSubmits] = useState(0);
  const [modal, setModal] = useState(false);
  useEffect(() => {
    let active = true;
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      if (url.pathname === "/api/auth/proof-challenge") return Response.json({ nonce: "test-nonce", serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() });
      if (url.pathname === "/api/admin/roles") {
        setLastQuery(url.search);
        const page = Number(url.searchParams.get("page")), size = Number(url.searchParams.get("size"));
        const names = ["ROOT", "관리자", "매니저", "유저"];
        const codes = ["ROOT", "ADMIN", "MANAGER", "USER"];
        const totalElements = 65;
        const start = (page - 1) * size;
        return Response.json({ page, size, totalPages: Math.ceil(totalElements / size), totalElements, items: Array.from({ length: Math.min(size, totalElements - start) }, (_, i) => ({ code: codes[start + i] ?? `ROLE_${start + i}`, name: names[start + i] ?? `추가 권한 ${start + i}`, description: "표시 개수 선택 UI 검증", version: 0 })) });
      }
      // 실제 관리·인증 API로 검증 요청을 전송하지 않는다.
      if (url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/auth/")) return Response.json({ detail: "검증에서 허용하지 않은 요청입니다." }, { status: 400 });
      return original(input, init);
    };
    void getBrowserKey(true).then(() => { if (active) setReady(true); });
    return () => { active = false; window.fetch = original; };
  }, []);
  return <main className={`app-page ${styles.screen}`} style={{ padding: "2rem", maxWidth: "100rem", marginInline: "auto" }}>
    <h1>표시 개수 선택창 검증 · 메모리 데이터</h1><p data-testid="query">{lastQuery}</p>
    {ready && <AdminScope value={{ sessionId: "select-test", context: { userId: 1, roleCode: "ROOT", roleName: "ROOT", roleVersion: 0, membershipVersion: 0, permissions: permissionCodes }, notifySaved: () => {} }}><RolesPanel /></AdminScope>}
    <section aria-label="폼 안의 선택창" style={{ marginTop: "2rem" }}><form onSubmit={event => { event.preventDefault(); setSubmits(count => count + 1); }}>
      <PageSizeSelect value={size} change={setSize} /><button type="submit">폼 제출</button><p data-testid="submits">제출 {submits}회</p><p data-testid="form-size">선택 {size}개</p>
    </form></section>
    <section aria-label="필터 개수 선택 검증"><PageSizeSelect value={filterSize} change={setFilterSize} sizes={FILTER_PAGE_SIZES} /></section>
    <button type="button" onClick={() => setModal(true)}>모달 열기</button>
    {modal && <CatalogDialog title="선택창 모달 검증" close={() => setModal(false)}><PageSizeSelect value={size} change={setSize} /></CatalogDialog>}
    <section aria-label="아래쪽 배치 검증" style={{ position: "fixed", bottom: "1rem", right: "1rem" }}><PageSizeSelect value={size} change={setSize} /></section>
  </main>;
}
