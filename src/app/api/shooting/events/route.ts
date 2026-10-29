// 인증된 변경 알림 스트림만 BFF를 통해 전달한다.
export { handleShootingEvents as POST } from "@/features/shooting/server/events";
