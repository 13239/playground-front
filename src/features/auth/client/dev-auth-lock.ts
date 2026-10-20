import { AuthRequestError } from "./error";

type Lease = Readonly<{ owner: string; expiresAt: number }>;
const leaseMillis = 120_000;

/** 원격 HTTP에는 Web Locks가 없다. dev에서만 IndexedDB의 원자 트랜잭션으로 탭 사이 쿠키 변경을 직렬화한다. */
export async function withDevAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!globalThis.indexedDB) throw new AuthRequestError("브라우저의 저장소 사용을 허용해 주세요.", 0);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("playground-auth-coordination", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("locks"); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = open.onblocked = () => reject(new AuthRequestError("로그인 요청을 준비하지 못했습니다. 다시 시도해 주세요.", 0));
  });
  database.onversionchange = () => database.close();
  // getRandomValues는 원격 HTTP에서도 지원한다. 개인키를 만들거나 보관하는 용도로 사용하지 않는다.
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
  const deadline = performance.now() + leaseMillis + 10_000;
  let renewal: ReturnType<typeof setInterval> | undefined;
  const update = (action: "acquire" | "renew" | "release") => new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction("locks", "readwrite");
    const store = transaction.objectStore("locks");
    const read = store.get("auth");
    let changed = false;
    read.onsuccess = () => {
      const current: Lease | undefined = read.result;
      const mine = current?.owner === owner;
      if (action === "release") {
        if (mine) { store.delete("auth"); changed = true; }
      } else if (mine || action === "acquire" && (!current || current.expiresAt <= Date.now())) {
        store.put({ owner, expiresAt: Date.now() + leaseMillis }, "auth"); changed = true;
      }
    };
    transaction.oncomplete = () => resolve(changed);
    transaction.onerror = transaction.onabort = () => reject(new AuthRequestError("로그인 요청을 준비하지 못했습니다. 다시 시도해 주세요.", 0));
  });
  try {
    while (!await update("acquire")) {
      if (performance.now() >= deadline) throw new AuthRequestError("다른 탭의 로그인 요청이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.", 0);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // 종료된 탭의 잠금은 회수할 수 있게 유한 임대를 사용하고, 진행 중인 요청의 임대는 짧게 갱신한다.
    renewal = setInterval(() => { void update("renew").catch(() => {}); }, 15_000);
    return await operation();
  } finally {
    if (renewal !== undefined) clearInterval(renewal);
    try { await update("release"); } catch { /* 해제에 실패해도 임대는 만료되며 성공한 인증 응답을 덮어쓰지 않는다. */ }
    database.close();
  }
}
