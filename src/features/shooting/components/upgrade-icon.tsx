import { Icon } from "@/components/ui/icon";
import type { UpgradeId } from "@playground/shooting-shared";
/** 강화·장착 현황 모두 같은 공통 아이콘을 사용한다. */
export function UpgradeIcon({ id }: { id: UpgradeId }) {
  const name =
    id === "health"
      ? "heart"
      : id === "armor" || id === "guard"
        ? "shield"
        : id === "fireRate" || id === "dash"
          ? "lightning"
          : id === "speed"
            ? "move"
            : id === "blast" || id === "shockwave"
              ? "sun"
              : "target";
  return <Icon name={name} />;
}
