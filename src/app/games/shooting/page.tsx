import type { Metadata } from "next";
import { ShootingScreen } from "@/features/shooting/components/shooting-screen";

export const metadata: Metadata = {
  // 짧은 맵 완주와 별 정복을 페이지 검색 정보에도 동일하게 안내한다.
  title: "슈팅게임 · 모험 모드",
  description:
    "수정 동굴부터 용암 성채까지 6개 맵을 공략하고 별을 모으는 1인·온라인 2인 협동 슈팅.",
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
