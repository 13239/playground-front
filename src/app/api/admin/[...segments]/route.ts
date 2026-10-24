import { handleAdminRequest } from "@/features/admin/server/routes";

/** App Router의 비동기 params를 해석한 뒤 허용 목록과 현재 세션 검증으로 연결한다. */
async function handle(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  return handleAdminRequest(request, (await context.params).segments);
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
// GET에서 자동 생성되는 HEAD가 관리자 조회를 실행하지 않도록 명시적으로 거절한다.
export const HEAD = () => new Response(null, { status: 405, headers: { "Allow": "GET, POST, PUT, DELETE", "Cache-Control": "no-store" } });
