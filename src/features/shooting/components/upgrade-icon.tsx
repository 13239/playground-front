import { Icon } from "@/components/ui/icon";
import { UPGRADES, type UpgradeId } from "@playground/shooting-shared";
/** 강화 선택·투자 현황 모두 같은 공통 아이콘을 사용한다. */
export function UpgradeIcon({ id }: { id: UpgradeId }) {
  // 강화 정의가 공통 아이콘 이름을 직접 지정해 카드와 HUD가 같은 표시를 쓴다.
  return <Icon name={UPGRADES[id].icon} />;
}
