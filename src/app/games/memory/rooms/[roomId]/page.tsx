import { notFound } from "next/navigation";
import { MemoryRoomScreen } from "@/features/memory/components/memory-room";
import { memoryMetadata } from "@/features/memory/server/metadata";
export const generateMetadata=memoryMetadata;
/** 직접 주소 접근도 안전한 방 번호만 받고 실제 참가 권한은 서버에서 검증한다. */
export default async function MemoryRoomPage({params}:{params:Promise<{roomId:string}>}){
  const {roomId}=await params;if(!/^[1-9]\d{0,14}$/.test(roomId))notFound();return <MemoryRoomScreen roomId={Number(roomId)}/>;
}
