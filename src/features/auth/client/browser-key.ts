import { AuthRequestError } from "./error";
import { calculateJwkThumbprint, type JWK } from "jose";

type BrowserKey = Readonly<{ version: 1; privateKey: CryptoKey; publicKey: JWK; thumbprint: string }>;

/** 로그인 키는 토큰과 분리한다. 개인키는 extractable=false인 CryptoKey로만 IndexedDB에 저장한다. */
export async function getBrowserKey(create: boolean): Promise<BrowserKey> {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle || !globalThis.indexedDB || !navigator.locks) {
    throw new AuthRequestError("보안 연결과 최신 브라우저가 필요합니다. 브라우저를 업데이트해 주세요.", 401, undefined, "BROWSER_KEY_REQUIRED");
  }
  let database: IDBDatabase;
  try {
    database = await new Promise((resolve, reject) => {
      const open = indexedDB.open("playground-auth", 1);
      open.onupgradeneeded = () => { open.result.createObjectStore("keys"); };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error());
      open.onblocked = () => reject(new Error());
    });
  } catch {
    throw new AuthRequestError("이 브라우저에 로그인 키를 저장할 수 없습니다. 브라우저의 저장소 설정을 확인해 주세요.", 401, undefined, "BROWSER_KEY_REQUIRED");
  }
  database.onversionchange = () => database.close();
  try {
    const existing = await new Promise<BrowserKey | undefined>((resolve, reject) => {
      const transaction = database.transaction("keys", "readonly");
      const result = transaction.objectStore("keys").get("browser-v1");
      transaction.oncomplete = () => resolve(result.result);
      transaction.onerror = transaction.onabort = () => reject(new Error());
    });
    if (existing) {
      if (existing.version !== 1 || !(existing.privateKey instanceof CryptoKey) || existing.privateKey.extractable
        || existing.privateKey.type !== "private" || existing.privateKey.algorithm.name !== "ECDSA"
        || (existing.privateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" || !existing.privateKey.usages.includes("sign")
        || existing.publicKey.kty !== "EC" || existing.publicKey.crv !== "P-256" || existing.publicKey.d
        || await calculateJwkThumbprint(existing.publicKey) !== existing.thumbprint) throw new Error();
      return existing;
    }
    if (!create) throw new Error();
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    // 공개키만 JWK로 내보낸다. Web Crypto는 개인키를 추출 불가로 생성해도 공개키 내보내기를 허용한다.
    const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const publicKey: JWK = { kty: "EC", crv: "P-256", x: exported.x, y: exported.y };
    const candidate: BrowserKey = { version: 1, privateKey: pair.privateKey, publicKey, thumbprint: await calculateJwkThumbprint(publicKey) };
    // 탭이 동시에 최초 로그인해도 읽기·쓰기를 한 트랜잭션으로 처리해 먼저 저장한 키를 사용한다.
    return await new Promise<BrowserKey>((resolve, reject) => {
      const transaction = database.transaction("keys", "readwrite");
      const store = transaction.objectStore("keys");
      const read = store.get("browser-v1");
      let winner = candidate;
      read.onsuccess = () => { if (read.result) winner = read.result; else store.put(candidate, "browser-v1"); };
      transaction.oncomplete = () => resolve(winner);
      transaction.onerror = transaction.onabort = () => reject(new Error());
    });
  } catch {
    // 세션 복원에서는 새 키를 자동 생성하거나 서버의 기존 키 바인딩을 바꾸지 않는다.
    throw new AuthRequestError("이 브라우저의 로그인 키를 확인할 수 없습니다. 다시 로그인해 주세요.", 401, undefined, "BROWSER_KEY_REQUIRED");
  } finally { database.close(); }
}
