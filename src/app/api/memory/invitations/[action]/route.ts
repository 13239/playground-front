import { handleMemory } from "@/features/memory/server/routes";
/** 친구 초대도 일반 게임 요청과 같은 인증 경계를 사용한다. */
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
  return handleMemory(request,`invitations/${(await context.params).action}`);
}
