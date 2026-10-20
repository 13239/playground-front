/** 서버의 ProfileAvatar 열거형과 같은 고정 식별자만 사용하며 외부 URL이나 업로드 파일은 받지 않는다. */
export const profileAvatars = [
  { id: "CAT", name: "포근한 고양이", image: "/images/avatars/cat.webp" },
  { id: "DOG", name: "다정한 강아지", image: "/images/avatars/dog.webp" },
  { id: "RABBIT", name: "몽실한 토끼", image: "/images/avatars/rabbit.webp" },
  { id: "FOX", name: "장난꾸러기 여우", image: "/images/avatars/fox.webp" },
  { id: "BEAR", name: "느긋한 곰", image: "/images/avatars/bear.webp" },
  { id: "PANDA", name: "졸린 판다", image: "/images/avatars/panda.webp" },
  { id: "OTTER", name: "호기심 많은 수달", image: "/images/avatars/otter.webp" },
  { id: "PENGUIN", name: "씩씩한 펭귄", image: "/images/avatars/penguin.webp" },
  { id: "FROG", name: "행운의 개구리", image: "/images/avatars/frog.webp" },
  { id: "DUCK", name: "햇살 같은 오리", image: "/images/avatars/duck.webp" },
] as const;

export type ProfileAvatarId = (typeof profileAvatars)[number]["id"];
export const defaultProfileAvatar: ProfileAvatarId = "CAT";

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return profileAvatars.some((avatar) => avatar.id === value);
}

export function getProfileAvatar(id: ProfileAvatarId) {
  return profileAvatars.find((avatar) => avatar.id === id) ?? profileAvatars[0];
}
