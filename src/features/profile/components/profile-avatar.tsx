import Image from "next/image";
import { getProfileAvatar, type ProfileAvatarId } from "../catalog";
import styles from "./profile.module.css";

/** 헤더·선택 화면과 향후 게임 화면이 같은 정적 캐릭터 이미지를 재사용한다. 이름은 주변 텍스트로 제공한다. */
export function ProfileAvatar({ avatarId, size = 80 }: { avatarId: ProfileAvatarId; size?: number }) {
  const avatar = getProfileAvatar(avatarId);
  return <Image src={avatar.image} alt="" width={size} height={size} className={styles.avatarImage} />;
}
