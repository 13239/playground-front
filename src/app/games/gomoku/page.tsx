import type { Metadata } from "next";
import { RoomList } from "@/features/gomoku/components/room-list";

export const metadata: Metadata = { title: "오목 방 목록" };

/** 목록 데이터는 보호된 BFF에서만 읽으며 SSR에 회원이나 방 정보를 포함하지 않는다. */
export default function GomokuPage() {
  return <RoomList />;
}
