import { MemoryLobby } from "@/features/memory/components/memory-lobby";
import { memoryMetadata } from "@/features/memory/server/metadata";
export const generateMetadata=memoryMetadata;
/** 게임 시작과 1인 랭킹·대기방 목록을 같은 페이지에서 제공한다. */
export default function MemoryPage(){return <MemoryLobby/>;}
