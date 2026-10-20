import type { Metadata } from "next";
import { CreateRoom } from "@/features/gomoku/components/create-room";

export const metadata: Metadata = { title: "오목 방 만들기" };

/** 폼은 클라이언트 입력을 받고 생성 권한·규칙은 BFF와 Spring이 다시 확인한다. */
export default function CreateGomokuRoomPage() {
  return <CreateRoom />;
}
