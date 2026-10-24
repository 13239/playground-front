import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

/** 경로는 공개된 메뉴만 허용한다. 실제 데이터 조회·변경 권한은 BFF와 Spring에서 매번 검사한다. */
export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && (section.length !== 1 || !["users", "roles", "operations", "games", "genres"].includes(section[0]))) notFound();
  return <AdminWorkspace section={section?.[0]} />;
}
