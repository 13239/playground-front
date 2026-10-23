/** 운영 안내만 공개한다. 길이·빈 문자열·제어 문자를 제한하고 화면에서는 평문으로 렌더링한다. */
// 기존 인증 모듈의 이름은 보존하고 게임 안내와 검증 구현을 공유한다.
export { parseOperationalNotice as parseAccessNotice } from "@/lib/operational-notice";
