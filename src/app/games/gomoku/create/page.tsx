import { gomokuMetadata } from "@/features/gomoku/server/metadata";
import { CreateRoom } from "@/features/gomoku/components/create-room";

// 방 정보는 포함하지 않고 현재 공개된 게임 이름만 브라우저 제목에 사용한다.
export function generateMetadata() { return gomokuMetadata("create"); }

/** 폼은 클라이언트 입력을 받고 생성 권한·규칙은 BFF와 Spring이 다시 확인한다. */
export default function CreateGomokuRoomPage() {
  return <CreateRoom />;
}
