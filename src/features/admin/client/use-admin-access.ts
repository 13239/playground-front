"use client";

import { useEffect, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/api";
import { useAuthSession } from "@/features/auth/client/session-store";
import type { AdminContext } from "../contracts";
import { adminRequest, errorMessage } from "./api";

type Access = Readonly<{ sessionId: string; status: "ready"; context: AdminContext } | { sessionId: string; status: "checking" | "denied" | "error"; message?: string }>;
const changeEvent = "playground:admin-access-changed";
let pending: { sessionId: string; promise: Promise<AdminContext>; revision: number } | undefined;
let cache: { sessionId: string; context: AdminContext; until: number } | undefined;
let revision = 0;

/** 헤더와 관리자 화면의 동시 조회를 합친다. 권한 변경 뒤에는 캐시를 비우고 각 화면이 다시 확인한다. */
export function invalidateAdminAccess(): void { revision++; cache = undefined; window.dispatchEvent(new Event(changeEvent)); }
function read(sessionId: string): Promise<AdminContext> {
  if (cache?.sessionId === sessionId && cache.until > Date.now()) return Promise.resolve(cache.context);
  if (pending?.sessionId === sessionId && pending.revision === revision) return pending.promise;
  const current = revision;
  const promise = adminRequest<AdminContext>(sessionId, "me").then(context => {
    if (current === revision) cache = { sessionId, context, until: Date.now() + 5000 };
    return context;
  }).finally(() => { if (pending?.promise === promise) pending = undefined; });
  pending = { sessionId, promise, revision: current };
  return promise;
}

/** 계정 변경·확인 장애에는 이전 권한을 즉시 숨긴다. 서버 검증을 대체하는 권한 캐시는 아니다. */
export function useAdminAccess() {
  const auth = useAuthSession();
  const sessionId = auth.status === "authenticated" && !auth.verificationError ? auth.session.sessionId : "";
  const userId = auth.status === "authenticated" ? auth.session.id : undefined;
  const [state, setState] = useState<Access>({ sessionId: "", status: "checking" });
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let generation = 0;
    let running = false;
    const load = () => {
      if (!active || running || document.visibilityState !== "visible") return;
      running = true;
      const current = ++generation;
      void read(sessionId).then(context => {
        if (context.userId !== userId || !context.permissions.includes("ADMIN_ACCESS")) throw new AuthRequestError("접근 권한이 없습니다.", 403);
        if (active && current === generation) setState({ sessionId, status: "ready", context });
      }).catch(error => {
        cache = undefined;
        if (active && current === generation) setState({ sessionId, status: error instanceof AuthRequestError && error.status === 403 ? "denied" : "error", message: errorMessage(error) });
      }).finally(() => { running = false; });
    };
    const changed = () => { generation++; running = false; setState({ sessionId, status: "checking" }); load(); };
    const interval = setInterval(load, 30000);
    load();
    window.addEventListener(changeEvent, changed);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; generation++; clearInterval(interval); window.removeEventListener(changeEvent, changed); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [sessionId, userId]);
  return { auth, access: sessionId && state.sessionId === sessionId ? state : { sessionId, status: "checking" } as Access };
}
