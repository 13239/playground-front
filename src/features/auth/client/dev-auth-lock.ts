import { AuthRequestError } from "./error";
import type { AuthRequestContext } from "./request-context";
import { reportConnectionIssue } from "@/lib/client/connection-diagnostics";

type Lease = Readonly<{ owner: string; expiresAt: number }>;
const waitMillis = 10_000;
const operationMillis = 45_000;
const leaseMarginMillis = 5_000;
const cleanupMillis = 2_000;

function storageError(): AuthRequestError {
  return new AuthRequestError("로그인 요청을 준비하지 못했습니다. 브라우저의 저장소 설정을 확인한 뒤 다시 시도해 주세요.", 0, undefined, "AUTH_STORAGE_UNAVAILABLE");
}

/** IndexedDB 열기는 직접 취소할 수 없으므로 늦게 열린 연결도 닫아 종료된 문서의 자원을 남기지 않는다. */
function openDatabase(signal: AbortSignal): Promise<IDBDatabase> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("playground-auth-coordination", 1);
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", fail);
      reject(signal.aborted ? signal.reason : storageError());
    };
    signal.addEventListener("abort", fail, { once: true });
    open.onupgradeneeded = () => {
      if (settled || signal.aborted) open.transaction?.abort();
      else open.result.createObjectStore("locks");
    };
    open.onsuccess = () => {
      if (settled || signal.aborted) { open.result.close(); return; }
      settled = true;
      signal.removeEventListener("abort", fail);
      resolve(open.result);
    };
    open.onerror = open.onblocked = fail;
  });
}

/** 획득과 해제는 같은 원자 트랜잭션을 사용하며 취소된 대기자가 뒤늦게 잠금을 저장하지 않게 한다. */
function updateLease(database: IDBDatabase, owner: string, expiresAt: number,
  action: "acquire" | "release", signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("locks", "readwrite");
    const store = transaction.objectStore("locks");
    const read = store.get("auth");
    let changed = false;
    const abort = () => {
      try { transaction.abort(); } catch { /* 이미 커밋했다면 finally의 소유권 확인 해제로 정리한다. */ }
    };
    signal.addEventListener("abort", abort, { once: true });
    read.onsuccess = () => {
      if (signal.aborted) { abort(); return; }
      const current: Lease | undefined = read.result;
      if (action === "release") {
        if (current?.owner === owner) { store.delete("auth"); changed = true; }
      } else if (!current || Number.isFinite(current.expiresAt) && current.expiresAt <= Date.now()) {
        store.put({ owner, expiresAt }, "auth"); changed = true;
      }
    };
    transaction.oncomplete = () => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(signal.reason);
      else resolve(changed);
    };
    transaction.onerror = transaction.onabort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.aborted ? signal.reason : storageError());
    };
  });
}

/** 다음 획득 시도까지의 짧은 대기도 취소와 함께 정리한다. */
function waitForTurn(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 100);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** 원격 HTTP에는 Web Locks가 없다. dev에서만 IndexedDB의 원자 트랜잭션으로 탭 사이 쿠키 변경을 직렬화한다. */
export async function withDevAuthLock<T>(operation: (context: AuthRequestContext) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  if (!globalThis.indexedDB) {
    reportConnectionIssue("auth-lock", "AUTH_STORAGE_UNAVAILABLE");
    throw new AuthRequestError("브라우저의 저장소 사용을 허용해 주세요.", 0, undefined, "AUTH_STORAGE_UNAVAILABLE");
  }
  // getRandomValues는 원격 HTTP에서도 지원한다. 개인키를 만들거나 보관하는 용도로 사용하지 않는다.
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
  const startedAt = Date.now();
  const startedTick = performance.now();
  const controller = new AbortController();
  const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  let acquired = false;
  let database: IDBDatabase | undefined;
  const timeoutError = () => new AuthRequestError(acquired
    ? "로그인 요청이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
    : "다른 탭의 로그인 요청이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.", 0, undefined,
    acquired ? "AUTH_REQUEST_TIMEOUT" : "AUTH_LOCK_WAIT_TIMEOUT");
  const context: AuthRequestContext = {
    signal: requestSignal,
    assertActive: () => {
      // 동결 중에는 타이머가 멈출 수 있으므로 각 후속 요청에서도 실제 경과 시간과 절대 만료를 확인한다.
      const limit = acquired ? operationMillis : waitMillis;
      if (Date.now() - startedAt >= limit || performance.now() - startedTick >= limit) controller.abort(timeoutError());
      requestSignal.throwIfAborted();
    },
  };
  const waitTimer = setTimeout(() => controller.abort(timeoutError()), waitMillis);
  const operationTimer = setTimeout(() => controller.abort(timeoutError()), operationMillis);
  const suspend = () => controller.abort(new DOMException("문서가 종료되어 로그인 요청을 취소했습니다.", "AbortError"));
  const resume = () => { try { context.assertActive(); } catch { /* 중단은 요청의 공통 오류 경계에서 처리한다. */ } };
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  document.addEventListener("freeze", suspend);
  document.addEventListener("visibilitychange", resume);
  try {
    database = await openDatabase(requestSignal);
    database.onversionchange = () => { controller.abort(storageError()); database?.close(); };
    // 전체 요청 기한 뒤에만 임대가 만료된다. 이전 버전의 살아 있는 120초 임대도 만료 전에는 빼앗지 않는다.
    const expiresAt = startedAt + operationMillis + leaseMarginMillis;
    while (true) {
      context.assertActive();
      if (await updateLease(database, owner, expiresAt, "acquire", requestSignal)) break;
      await waitForTurn(requestSignal);
    }
    context.assertActive();
    acquired = true;
    clearTimeout(waitTimer);
    // 종료된 탭의 잠금은 회수할 수 있게 유한 임대를 사용한다. 갱신·재조회도 전체 45초 기한을 공유해 임대를 무한 연장하지 않는다.
    const result = await operation(context);
    context.assertActive();
    return result;
  } catch (error) {
    // 잠금 준비 오류만 이 단계에 기록한다. 실제 API·갱신 실패의 단계는 각 호출자가 구분한다.
    if (error instanceof AuthRequestError && ["AUTH_STORAGE_UNAVAILABLE", "AUTH_LOCK_WAIT_TIMEOUT"].includes(error.code ?? "")) {
      reportConnectionIssue("auth-lock", error.code, error.status);
    }
    throw error;
  } finally {
    clearTimeout(waitTimer);
    clearTimeout(operationTimer);
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("freeze", suspend);
    document.removeEventListener("visibilitychange", resume);
    if (database) {
      // 획득 직후 취소된 경우도 소유권을 확인해 해제한다. 정리 장애가 성공 응답을 무한히 붙잡지 않게 별도 상한을 둔다.
      const cleanup = new AbortController();
      const cleanupTimer = setTimeout(() => cleanup.abort(storageError()), cleanupMillis);
      try { await updateLease(database, owner, 0, "release", cleanup.signal); }
      catch { /* 해제에 실패해도 임대는 만료되며 성공한 인증 응답을 덮어쓰지 않는다. */ }
      finally { clearTimeout(cleanupTimer); database.close(); }
    }
  }
}
