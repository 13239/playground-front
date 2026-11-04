import Image from "next/image";

/** 전장과 같은 캐릭터·몬스터를 고해상도 표지로 표시한다. 승인한 스테이지 외형과 목록의 인상을 일치시킨다. */
export function ShootingCover() {
  return (
    <Image
      src="/images/shooting/stage-v3/stage-cover.png"
      width={1672}
      height={941}
      sizes="(max-width: 700px) 90vw, 30vw"
      alt="수정 동굴을 함께 공략하는 슈팅 캐릭터"
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
