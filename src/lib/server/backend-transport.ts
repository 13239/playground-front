import "server-only";

import { readFileSync, statSync } from "node:fs";
import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { ApiError } from "./api-error";
import { getAppEnvironment } from "./env";

const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 16 });
let httpsAgent: HttpsAgent | undefined;

/** 운영은 전용 CA·BFF 인증서·개인키가 모두 필요하다. 인증서 오류를 무시하는 옵션은 제공하지 않는다. */
function tlsAgent(): HttpsAgent {
  if (httpsAgent) return httpsAgent;
  try {
    const paths = ["BACKEND_CA_CERT_PATH", "BFF_CLIENT_CERT_PATH", "BFF_CLIENT_KEY_PATH"].map(name => {
      const file = process.env[name];
      if (!file || !statSync(file).isFile() || statSync(file).size > 65_536) throw new Error();
      return readFileSync(file);
    });
    httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 16,
      ca: paths[0], cert: paths[1], key: paths[2], rejectUnauthorized: true, minVersion: "TLSv1.3" });
    return httpsAgent;
  } catch {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
}

/** Node 표준 HTTPS로 mTLS를 사용한다. 리다이렉트·자동 재시도·응답 캐시는 없으며 본문은 최대 1MiB다. */
export async function backendFetch(url: URL, options: { method: string; headers: Headers; body?: string; signal: AbortSignal }): Promise<Response> {
  const secure = url.protocol === "https:";
  const environment = getAppEnvironment();
  // dev만 Docker 서비스 이름으로 HTTP 연결할 수 있다. local은 루프백, prod는 mTLS를 유지한다.
  if (!secure && (environment === "prod" || environment === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
  const agent = secure ? tlsAgent() : httpAgent;
  return new Promise((resolve, reject) => {
    const request = (secure ? httpsRequest : httpRequest)(url, {
      method: options.method, headers: Object.fromEntries(options.headers), signal: options.signal, agent,
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_048_576) { request.destroy(); reject(new ApiError("INVALID_BACKEND_RESPONSE")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const status = response.statusCode ?? 502;
          if (status >= 300 && status < 400) { reject(new ApiError("INVALID_BACKEND_RESPONSE")); return; }
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, headers }));
        } catch { reject(new ApiError("INVALID_BACKEND_RESPONSE")); }
      });
    });
    request.on("error", reject);
    request.end(options.body);
  });
}
