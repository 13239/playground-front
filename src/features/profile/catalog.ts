/** 서버의 ProfileAvatar 열거형과 같은 고정 식별자만 사용하며 외부 URL이나 업로드 파일은 받지 않는다. */
// 확정한 20종만 제공한다. 시안 번호는 표시 순서와 분리하고 새 경로로 이전 이미지 캐시와 구분한다.
export const profileAvatars = [
  { id: "SPROUT", conceptNumber: 5, name: "새싹 요정", image: "/images/avatars/characters-v1/05-sprout.webp" },
  { id: "CLOUD", conceptNumber: 6, name: "구름 유령", image: "/images/avatars/characters-v1/06-cloud.webp" },
  { id: "JELLY_STAR", conceptNumber: 8, name: "별 젤리", image: "/images/avatars/characters-v1/08-jelly-star.webp" },
  { id: "LILAC_ROBOT", conceptNumber: 9, name: "미니 로봇", image: "/images/avatars/characters-v1/09-lilac-robot.webp" },
  { id: "HOODIE_PENGUIN", conceptNumber: 11, name: "후드 펭귄", image: "/images/avatars/characters-v1/11-hoodie-penguin.webp" },
  { id: "HEADPHONE_DINO", conceptNumber: 12, name: "헤드폰 공룡", image: "/images/avatars/characters-v1/12-headphone-dino.webp" },
  { id: "SEAL", conceptNumber: 13, name: "스카프 물범", image: "/images/avatars/characters-v1/13-seal.webp" },
  { id: "RAIN_HAT_FROG", conceptNumber: 14, name: "우비 개구리", image: "/images/avatars/characters-v1/14-rain-hat-frog.webp" },
  { id: "RAINDROP", conceptNumber: 26, name: "구름모자 물방울", image: "/images/avatars/characters-v1/26-raindrop.webp" },
  { id: "WIZARD_MOCHI", conceptNumber: 28, name: "모찌 마법사", image: "/images/avatars/characters-v1/28-wizard-mochi.webp" },
  { id: "MINT_ROBOT", conceptNumber: 29, name: "민트 로봇", image: "/images/avatars/characters-v1/29-mint-robot.webp" },
  { id: "HOODIE_HAMSTER", conceptNumber: 30, name: "후드 햄스터", image: "/images/avatars/characters-v1/30-hoodie-hamster.webp" },
  { id: "HEADPHONE_DRAGON", conceptNumber: 31, name: "헤드폰 드래곤", image: "/images/avatars/characters-v1/31-headphone-dragon.webp" },
  { id: "HEADPHONE_ALIEN", conceptNumber: 55, name: "헤드폰 외계인", image: "/images/avatars/characters-v1/55-headphone-alien.webp" },
  { id: "CREAM_ROBOT", conceptNumber: 56, name: "크림 로봇", image: "/images/avatars/characters-v1/56-cream-robot.webp" },
  { id: "PEACH_SPROUT", conceptNumber: 59, name: "새싹 모찌", image: "/images/avatars/characters-v1/59-peach-sprout.webp" },
  { id: "BLUE_OWL", conceptNumber: 85, name: "하늘색 부엉이", image: "/images/avatars/characters-v1/85-blue-owl.webp" },
  { id: "GAMER_GHOST", conceptNumber: 105, name: "게임하는 유령", image: "/images/avatars/characters-v1/105-gamer-ghost.webp" },
  { id: "HEADPHONE_WHALE", conceptNumber: 116, name: "헤드폰 고래", image: "/images/avatars/characters-v1/116-headphone-whale.webp" },
  { id: "SNOWMAN", conceptNumber: 129, name: "눈사람", image: "/images/avatars/characters-v1/129-snowman.webp" },
] as const;

export type ProfileAvatarId = (typeof profileAvatars)[number]["id"];
// 5번 새싹 요정을 서버·DB와 같은 기본 캐릭터로 사용한다.
export const defaultProfileAvatar: ProfileAvatarId = "SPROUT";

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return profileAvatars.some((avatar) => avatar.id === value);
}

export function getProfileAvatar(id: ProfileAvatarId) {
  return profileAvatars.find((avatar) => avatar.id === id) ?? profileAvatars[0];
}
