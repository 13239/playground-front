import { gomokuMetadata } from "@/features/gomoku/server/metadata";
import { RoomList } from "@/features/gomoku/components/room-list";

// 게임 이름·소개는 관리자와 같은 공개 카탈로그에서 요청마다 읽는다.
export function generateMetadata() { return gomokuMetadata("list"); }

/** 목록 데이터는 보호된 BFF에서만 읽으며 SSR에 회원이나 방 정보를 포함하지 않는다. */
export default function GomokuPage() {
  return <RoomList />;
}
