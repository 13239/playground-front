import { handleMemory } from "@/features/memory/server/routes";
/** 허용된 게임 동작만 전용 BFF 검증으로 전달한다. */
export async function POST(request:Request,context:{params:Promise<{operation:string}>}){
  return handleMemory(request,(await context.params).operation);
}
