"use client";

import type { ComponentProps } from "react";
import { RoomDialog } from "@/components/ui/game-dialog";
import theme from "./shooting-theme.module.css";

/** body 포털에서도 슈팅의 다크 테마를 유지하고 네이티브 모달의 접근성·Escape·요청 중 닫기 방지를 공유한다. */
export function ShootingRoomDialog({
  className,
  ...props
}: ComponentProps<typeof RoomDialog>) {
  return (
    <RoomDialog {...props} className={`${theme.dialog} ${className ?? ""}`} />
  );
}
