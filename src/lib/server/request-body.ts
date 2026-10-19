import "server-only";

import { ApiError } from "./api-error";

/** Content-Length 유무와 관계없이 실제 읽는 바이트를 제한한 뒤 JSON을 해석한다. */
export async function readJsonBody(request: Request, maxBytes = 4096): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json"
    || ![null, "identity"].includes(request.headers.get("content-encoding"))) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new ApiError("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new ApiError("INVALID_REQUEST_BODY");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    // 크기 초과·연결 중단 시 남은 본문은 읽지 않으며 입력 원문도 오류에 포함하지 않는다.
    void reader.cancel().catch(() => {});
    throw error instanceof ApiError ? error : new ApiError("INVALID_REQUEST_BODY");
  } finally {
    reader.releaseLock();
  }
}
