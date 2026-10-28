import type { CSSProperties } from "react";
import styles from "./memory.module.css";

// 사용자가 선택한 원본 번호 순서다. 카드 정답은 이 목록의 0~14 인덱스만 사용한다.
export const CHARACTERS=["토끼","여우","곰","고양이","개구리","펭귄","병아리","문어","고래","거북이","코끼리","아기 용","유령","다람쥐","부엉이"] as const;
export const ATLAS="/images/memory/characters-spaced.png";
// 생성 이미지의 실제 중심을 기준으로 280px 정사각 영역을 사용한다. 이웃 캐릭터 없이 귀·날개·꼬리를 보존한다.
const CENTERS = [[202,298],[533,291],[814,293],[1126,300],[1415,297],
  [200,556],[513,552],[813,560],[1134,558],[1419,568],
  [204,819],[528,812],[818,821],[1136,812],[1418,817]] as const;
/** 같은 5×3 아틀라스를 한 번 내려받아 카드·표지에서 재사용하고, 칸마다 실제 중심과 여백을 보정한다. */
export function Character({index}:{index:number}){
  const [x,y] = CENTERS[index] ?? CENTERS[0];
  return <span className={styles.character} aria-hidden style={{
    backgroundPosition:`${(x-140)/(1619-280)*100}% ${(y-140)/(971-280)*100}%`,
    backgroundSize:`${1619/280*100}% ${971/280*100}%`,
  } as CSSProperties}/>;
}
let loading:Promise<void>|undefined;
/** 최초 3초 공개 전에 이미지 디코딩을 끝내 느린 로딩이 기억 시간을 줄이지 않도록 한다. */
export function preloadCharacters(){
  return loading??=new Promise<void>((resolve,reject)=>{const image=new Image();image.src=ATLAS;image.decode().then(()=>resolve()).catch(error=>{loading=undefined;reject(error);});});
}
