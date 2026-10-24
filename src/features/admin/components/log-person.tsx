import Image from "next/image";
import { getProfileAvatar } from "@/features/profile/catalog";
import type { LogPerson } from "../log-contracts";
import styles from "./logs.module.css";

/** 삭제된 회원도 기록의 번호로 구분하며 시스템 작업과 미확인 회원을 서로 다르게 표시한다. */
export function LogPersonLabel({ person, system = false }: { person: LogPerson; system?: boolean }) {
  const title = person.id === null ? system ? "시스템" : "미확인 회원" : person.nickname || person.username || `회원 #${person.id}`;
  return <span className={styles.person}>
    {person.id !== null && <Image src={getProfileAvatar(person.avatarId).image} width={32} height={32} alt="" />}
    <span><strong>{title}</strong>{person.id !== null && <small>{person.username ? `${person.username} · ` : ""}#{person.id}</small>}</span>
  </span>;
}
