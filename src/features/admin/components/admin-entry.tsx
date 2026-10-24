"use client";

import Link from "next/link";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "@/app/_components/lobby/lobby.module.css";
import { useAdminAccess } from "../client/use-admin-access";

/** 헤더의 알림 바로 왼쪽에만 배치하며 현재 ADMIN_ACCESS가 확인된 사용자에게만 표시한다. */
export function AdminEntry() {
  const { access } = useAdminAccess();
  if (access.status !== "ready") return null;
  return <Link href="/admin" prefetch={false} className={styles.iconButton} aria-label="관리자 페이지" title="관리자 페이지"><LobbyIcon name="gear" /></Link>;
}
