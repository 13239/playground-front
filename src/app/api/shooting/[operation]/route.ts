import { handleShooting } from "@/features/shooting/server/routes";

/** 배포 코드에 등록한 공개 동작 외의 임의 백엔드 경로는 실행하지 않는다. */
export async function POST(
  request: Request,
  context: { params: Promise<{ operation: string }> },
) {
  const { operation } = await context.params;
  if (
    operation !== "ticket" &&
    operation !== "overview" &&
    operation !== "rooms"
  )
    return new Response(null, { status: 404 });
  return handleShooting(request, operation);
}
