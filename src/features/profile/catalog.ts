/** 서버의 ProfileAvatar 열거형과 같은 고정 식별자만 사용하며 외부 URL이나 업로드 파일은 받지 않는다. */
// 기존 회원의 선택값을 유지하고, 새 경로의 방울 없는 전신 캐릭터 15종으로 이전 이미지 캐시와 구분한다.
export const profileAvatars = [
  { id: "CAT", name: "포근한 고양이", image: "/images/avatars/plush-v2/cat.webp" },
  { id: "DOG", name: "다정한 강아지", image: "/images/avatars/plush-v2/dog.webp" },
  { id: "RABBIT", name: "몽실한 토끼", image: "/images/avatars/plush-v2/rabbit.webp" },
  { id: "FOX", name: "장난꾸러기 여우", image: "/images/avatars/plush-v2/fox.webp" },
  { id: "BEAR", name: "느긋한 곰", image: "/images/avatars/plush-v2/bear.webp" },
  { id: "PANDA", name: "포동한 판다", image: "/images/avatars/plush-v2/panda.webp" },
  { id: "OTTER", name: "호기심 많은 수달", image: "/images/avatars/plush-v2/otter.webp" },
  { id: "PENGUIN", name: "씩씩한 펭귄", image: "/images/avatars/plush-v2/penguin.webp" },
  { id: "SHEEP", name: "뽀송한 아기 양", image: "/images/avatars/plush-v2/sheep.webp" },
  { id: "DUCK", name: "햇살 같은 오리", image: "/images/avatars/plush-v2/duck.webp" },
  { id: "GRAY_CAT", name: "나긋한 회색 고양이", image: "/images/avatars/plush-v2/gray-cat.webp" },
  { id: "RACCOON", name: "장난기 많은 라쿤", image: "/images/avatars/plush-v2/raccoon.webp" },
  { id: "HAMSTER", name: "동글동글 햄스터", image: "/images/avatars/plush-v2/hamster.webp" },
  { id: "KOALA", name: "차분한 코알라", image: "/images/avatars/plush-v2/koala.webp" },
  { id: "RED_PANDA", name: "수줍은 레서판다", image: "/images/avatars/plush-v2/red-panda.webp" },
] as const;

export type ProfileAvatarId = (typeof profileAvatars)[number]["id"];
export const defaultProfileAvatar: ProfileAvatarId = "CAT";

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return profileAvatars.some((avatar) => avatar.id === value);
}

export function getProfileAvatar(id: ProfileAvatarId) {
  return profileAvatars.find((avatar) => avatar.id === id) ?? profileAvatars[0];
}
