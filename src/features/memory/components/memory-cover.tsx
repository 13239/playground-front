import { Character } from "./character";
import styles from "./memory.module.css";

/** 실제 게임의 선택된 캐릭터와 같은 자산을 로비 표지에 사용한다. */
export function MemoryCover(){return <div className={styles.cover} aria-label="귀여운 캐릭터 카드의 같은 그림 찾기"><span><Character index={0}/></span><span><Character index={1}/></span><span><Character index={3}/></span></div>;}
