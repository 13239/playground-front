import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WaitingRoomScreen } from "@/features/gomoku/components/waiting-room";

// 같은 참가 URL에서 대기·흑백 추첨·대국·결과를 이어서 제공한다.
export const metadata: Metadata = { title: "오목 대국" };

/** 방 정보는 로그인·참가 검증 뒤 BFF로 조회하고 SSR HTML에는 방 코드나 참가자 정보를 넣지 않는다. */
export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  if (
    !/^[1-9][0-9]{0,15}$/.test(roomId) ||
    !Number.isSafeInteger(Number(roomId))
  )
    notFound();
  return <WaitingRoomScreen roomId={Number(roomId)} />;
}
