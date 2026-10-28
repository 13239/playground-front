import "server-only";
import { connection } from "next/server";
import { readPublicGame } from "@/features/games/server/catalog";

/** 관리자 변경 이름을 요청 시점에 조회하고 방 코드·회원 데이터는 제목에 포함하지 않는다. */
export async function memoryMetadata(){
  await connection();
  try{const game=await readPublicGame("MEMORY");return {title:game.name,description:game.summary};}
  catch{return {title:"게임",description:"게임 이용 정보를 확인해 주세요."};}
}
