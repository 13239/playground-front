import type { Metadata } from "next";
import { ShootingScreen } from "@/features/shooting/components/shooting-screen";

export const metadata: Metadata = {
  title: "슈팅 서바이벌",
  description: "직접 조준하고 함께 살아남는 1인·온라인 2인 슈팅 서바이벌.",
};
/** 브라우저 게임은 인증 확인 뒤 화면 내부에서만 초기화한다. */
export default async function ShootingPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  // 링크의 방 식별자만 허용하고 참가 권한·정원은 서버가 다시 검증한다.
  const { room } = await searchParams;
  const roomCode =
    typeof room === "string" && /^[A-Z2-9]{8}$/.test(room) ? room : undefined;
  return <ShootingScreen roomCode={roomCode} />;
}
