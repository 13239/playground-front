"use client";
import { useEffect,useRef,useState } from "react";

/** 음원 요청 없이 짧은 효과음을 합성한다. 사용자의 입력 후에만 오디오를 활성화한다. */
export function useMemorySound(){
  const [enabled,setEnabled]=useState(false);const audio=useRef<AudioContext | undefined>(undefined);
  useEffect(()=>{queueMicrotask(()=>{try{setEnabled(localStorage.getItem("memory:sound:v1")==="on");}catch{/* 저장소 제한 시 기본 음소거를 유지한다. */}});return()=>{void audio.current?.close();};},[]);
  function unlock(){if(!enabled)return;try{audio.current??=new AudioContext();void audio.current.resume();}catch{/* 오디오를 지원하지 않아도 게임 진행은 유지한다. */}}
  function play(kind:"flip"|"match"|"miss"|"finish"){
    if(!enabled||!audio.current||audio.current.state!=="running")return;
    const context=audio.current,tones=kind==="match"?[660,880]:kind==="miss"?[250,190]:kind==="finish"?[523,659,784,1047]:[440];
    tones.forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.085;
      oscillator.type="sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.045,at);gain.gain.exponentialRampToValueAtTime(.001,at+.12);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.13);});
  }
  function toggle(){const next=!enabled;setEnabled(next);try{localStorage.setItem("memory:sound:v1",next?"on":"off");}catch{/* 설정 저장이 막혀도 현재 화면의 선택은 유지한다. */}
    if(next){try{audio.current??=new AudioContext();void audio.current.resume();}catch{/* 지원하지 않는 환경은 무음으로 동작한다. */}}}
  return {enabled,toggle,unlock,play};
}

