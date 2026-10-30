import "server-only";

import { unstable_rethrow } from "next/navigation";
import { parseOperationalNotice } from "@/lib/operational-notice";

// 백엔드 원문 오류 대신 허용한 상태·메시지만 브라우저에 제공한다.
const errors = {
  // 게임 서버의 인증 원문이나 내부 주소는 노출하지 않고 고정된 안내만 전달한다.
  // 공통 게임 초대는 인증 만료와 구분해 현재 창에서 재시도한다.
  GAME_INVITATION_EXPIRED: [409, "초대가 만료되었거나 방 상태가 변경되었습니다. 다시 초대해 주세요."],
  GAME_INVITATION_BUSY: [409, "이미 응답을 기다리는 초대가 있습니다."],
  GAME_INVITATION_TARGET_UNAVAILABLE: [409, "지금은 이 친구를 초대할 수 없습니다. 접속·참가 상태를 확인해 주세요."],
  GAME_INVITATION_RATE_LIMIT: [429, "초대 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  SHOOTING_UNAVAILABLE: [503, "슈팅 게임 서버를 일시적으로 이용할 수 없습니다."],
  SHOOTING_TICKET_INVALID: [409, "게임 접속 증명이 만료되었습니다. 다시 입장해 주세요."],
  SHOOTING_ALREADY_PLAYING: [409, "이미 다른 화면에서 슈팅 게임을 이용하고 있습니다."],
  SHOOTING_RATE_LIMIT: [429, "게임 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  SHOOTING_RECORD_INVALID: [409, "게임 기록을 확인하지 못했습니다."],
  // 친구/그룹 오류는 인증 만료와 구분하고 공개된 짧은 안내만 전달한다.
  SOCIAL_NOT_FOUND: [404, "친구 또는 요청 정보를 찾을 수 없습니다."],
  SOCIAL_CONFLICT: [409, "상태가 변경되었습니다. 새로 확인한 뒤 다시 시도해 주세요."],
  SOCIAL_ACCESS_DENIED: [403, "현재 친구 또는 그룹 참가 권한이 없습니다."],
  SOCIAL_LIMIT_EXCEEDED: [429, "친구 요청 또는 그룹 인원 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."],
  // 친구 요청 폭주·거절 후 보호·관계 한도는 검증된 개별 안내로 전달한다.
  SOCIAL_RATE_LIMIT_EXCEEDED: [429, "요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  SOCIAL_FRIEND_REQUEST_COOLDOWN: [409, "같은 상대에게 친구 요청을 연속 5번 거절당했어요. 마지막 거절 후 24시간이 지나면 다시 보낼 수 있어요."],
  SOCIAL_FRIEND_REQUEST_DAILY_LIMIT: [429, "최근 24시간 동안 친구 요청을 50회 보냈어요. 이전 요청을 보낸 지 24시간이 지나면 다시 시도해 주세요."],
  SOCIAL_FRIEND_CAPACITY: [409, "친구는 최대 200명까지 추가할 수 있어요. 친구 목록을 정리한 뒤 다시 시도해 주세요."],
  SOCIAL_FRIEND_REQUEST_INBOX_FULL: [409, "상대의 받은 친구 요청이 가득 찼어요. 상대가 요청을 정리한 뒤 다시 시도해 주세요."],
  SOCIAL_UNAVAILABLE: [503, "친구 기능을 일시적으로 이용할 수 없습니다. 다시 시도해 주세요."],
  // 본인 탈퇴의 비밀번호 대입 제한은 세션 만료와 구분하고 서버가 정한 재시도 간격을 유지한다.
  ACCOUNT_WITHDRAWAL_RATE_LIMIT_EXCEEDED: [429, "회원탈퇴 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  // 테트리스 기록 오류는 계정 만료와 구분해 게임 화면에서 재시도를 제공한다.
  TETRIS_RUN_CHANGED: [409, "이전 게임의 기록입니다. 현재 화면에서 새 게임을 시작해 주세요."],
  // 같은 그림 찾기도 서버 원문 대신 고정된 공개 안내만 제공한다.
  MEMORY_CHANGED: [409, "카드 상태가 변경되었습니다. 현재 판을 확인해 주세요."],
  MEMORY_RATE_LIMIT: [429, "게임 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  MEMORY_UNAVAILABLE: [503, "같은 그림 찾기를 일시적으로 이용할 수 없습니다."],
  MEMORY_INVITATION_EXPIRED: [409, "초대가 만료되었거나 방 상태가 변경되었습니다."],
  MEMORY_INVITATION_BUSY: [409, "이미 응답을 기다리는 초대가 있습니다."],
  TETRIS_REPLAY_INVALID: [400, "플레이 기록을 검증하지 못했습니다."],
  TETRIS_RATE_LIMIT_EXCEEDED: [429, "테트리스 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
  TETRIS_UNAVAILABLE: [503, "테트리스를 일시적으로 이용할 수 없습니다."],
  // 로그 저장소 오류는 로그인 만료와 구분하고 내부 SQL·JSON 원문을 공개하지 않는다.
  ADMIN_LOG_NOT_FOUND: [404, "로그 기록을 찾을 수 없습니다."],
  ADMIN_LOG_UNAVAILABLE: [503, "로그 기록을 일시적으로 조회할 수 없습니다."],
  // 내부 채팅 서비스의 상세 오류나 주소 대신 검증된 공개 문구만 노출한다.
  ADMIN_CHAT_NOT_FOUND: [404, "채팅 기록을 찾을 수 없습니다."],
  ADMIN_CHAT_UNAVAILABLE: [503, "채팅 기록을 일시적으로 조회할 수 없습니다."],
  // 회원 편집 충돌과 권한/저장소 실패를 로그인 만료와 구분한다.
  USER_MANAGEMENT_CHANGED: [409, "회원 정보가 변경되었습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요."],
  USER_SELF_OPERATION_NOT_ALLOWED: [409, "현재 로그인한 본인 계정은 비활성화할 수 없습니다."],
  USER_MANAGEMENT_UNAVAILABLE: [503, "회원 관리 서비스를 일시적으로 이용할 수 없습니다."],
  // 관리 기능의 충돌과 권한 오류를 토큰 만료로 처리하거나 내부 예외 원문으로 노출하지 않는다.
  ROLE_NOT_FOUND: [404, "권한을 찾을 수 없습니다."],
  ROLE_ALREADY_EXISTS: [409, "이미 사용 중인 권한 코드입니다."],
  ROLE_PROTECTED: [409, "ROOT 권한 또는 ROOT 계정은 변경하거나 삭제할 수 없습니다."],
  // 삭제 거절은 서버 원문 대신 검증된 사용처별 안내를 팝업에 전달한다.
  ROLE_IN_USE: [409, "회원에게 배정되어 사용 중인 권한은 삭제할 수 없습니다."],
  ROLE_ACCESS_POLICY_IN_USE: [409, "접속 허용 설정에서 사용 중인 권한입니다. 설정에서 해당 권한을 먼저 제외해 주세요."],
  ROLE_DEFAULT_IN_USE: [409, "신규 회원가입의 기본 권한으로 사용 중이므로 삭제할 수 없습니다."],
  ROLE_PERMISSION_NOT_ASSIGNABLE: [400, "ROOT 전용 기능은 다른 권한에 부여할 수 없습니다."],
  AUTHORIZATION_CHANGED: [409, "다른 관리자가 먼저 수정했습니다. 최신 내용을 불러온 뒤 다시 편집해 주세요."],
  AUTHORIZATION_SERVICE_UNAVAILABLE: [503, "관리 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  ACCESS_EXEMPTION_INVALID: [400, "접속을 허용할 권한을 다시 확인해 주세요."],
  CATALOG_GENRE_NOT_FOUND: [404, "게임 장르를 찾을 수 없습니다."],
  CATALOG_GENRE_DISABLED: [409, "사용 중지된 장르는 새로 연결할 수 없습니다. 장르 선택을 확인해 주세요."],
  GAME_CONFIGURATION_INVALID: [400, "게임 설정이 지원 범위를 벗어났습니다. 입력값을 확인해 주세요."],
  // 관리 카드 라벨의 지원 범위 오류를 임의 서버 메시지 없이 공개한다.
  GAME_FILTER_NOT_FOUND: [404, "게임 필터를 찾을 수 없습니다."],
  GAME_FILTER_CONFIGURATION_INVALID: [400, "필터 유형과 조건을 확인해 주세요."],
  GAME_FILTER_IN_USE: [409, "연결된 게임이 있어 삭제하거나 조건을 변경할 수 없습니다. 게임 연결을 먼저 해제해 주세요."],
  GAME_CARD_LABEL_INVALID: [400, "선택한 카드 라벨이 현재 게임 정보와 맞지 않습니다. 라벨을 다시 선택해 주세요."],
  GAME_CATALOG_CHANGED: [409, "게임 설정이 변경되었습니다. 최신 내용을 불러온 뒤 다시 편집해 주세요."],
  GAME_CATALOG_CONFLICT: [409, "이미 등록되어 있거나 다른 관리자가 변경한 설정입니다."],
  VALIDATION_FAILED: [400, "입력값이 올바르지 않습니다."],
  INVALID_REQUEST_BODY: [400, "요청 본문의 형식 또는 값이 올바르지 않습니다."],
  PAYLOAD_TOO_LARGE: [413, "요청 본문이 너무 큽니다."],
  UNSUPPORTED_MEDIA_TYPE: [415, "JSON 형식으로 요청해 주세요."],
  DUPLICATE_USERNAME: [409, "이미 사용 중인 아이디입니다."],
  // 오목 방의 충돌과 일시적인 생성 실패를 내부 DB 오류 없이 구분한다.
  ROOM_ALREADY_HOSTING: [409, "이미 만든 방이 있습니다. 목록에서 내 방을 확인해 주세요."],
  ROOM_REQUEST_EXPIRED: [409, "이미 닫힌 방의 요청입니다. 새로 방을 만들어 주세요."],
  ROOM_NOT_FOUND: [404, "방을 찾을 수 없습니다."],
  ROOM_CANNOT_CLOSE: [409, "다른 참가자가 있거나 대국 중인 방은 닫을 수 없습니다."],
  ROOM_CODE_UNAVAILABLE: [503, "방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ROOM_RATE_LIMIT_EXCEEDED: [429, "방 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  ROOM_SERVICE_UNAVAILABLE: [503, "오목 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  // 대기실의 충돌·비밀번호 오류를 로그인 만료로 취급하지 않는다.
  ROOM_ALREADY_JOINED: [409, "참여 중인 방이 있습니다. 기존 방에서 나간 뒤 입장해 주세요."],
  // 다른 탭의 플레이 권한은 인증과 무관하게 서버가 거절하고 화면은 복구를 중단한다.
  ROOM_PAGE_IN_USE: [409, "다른 탭에서 이 대국을 이용하고 있습니다. 기존 탭에서 나간 뒤 다시 시도해 주세요."],
  ROOM_FULL: [409, "방이 가득 찼습니다. 다른 방을 선택해 주세요."],
  ROOM_CLOSED: [410, "이미 닫힌 방입니다. 다른 방을 선택해 주세요."],
  ROOM_NOT_JOINED: [409, "이 방의 참가자가 아닙니다. 목록에서 다시 입장해 주세요."],
  ROOM_PASSWORD_REQUIRED: [400, "비공개 방 비밀번호를 입력해 주세요."],
  ROOM_PASSWORD_INVALID: [400, "방 비밀번호가 올바르지 않습니다."],
  ROOM_NOT_FULL: [409, "상대가 입장한 뒤 준비해 주세요."],
  // 강퇴와 권한·좌석 변경 오류를 공개 계약으로 전달하고 원본 서버 메시지는 노출하지 않는다.
  ROOM_KICKED: [403, "방장에 의해 강퇴되었습니다.\n이 방에는 다시 입장할 수 없습니다."],
  ROOM_KICKED_REJOIN_ALLOWED: [403, "방장에 의해 강퇴되었습니다."],
  ROOM_KICK_FORBIDDEN: [403, "상대 강퇴는 대기 중인 방장만 할 수 있습니다."],
  ROOM_KICK_TARGET_CHANGED: [409, "참가자 정보가 변경되었습니다. 확인 후 다시 시도해 주세요."],
  // 방 설정의 권한·편집 충돌은 서버 원문 없이 공개 안내로만 전달한다.
  ROOM_SETTINGS_FORBIDDEN: [403, "방 설정은 현재 방장만 변경할 수 있습니다."],
  ROOM_SETTINGS_CHANGED: [409, "방 상태가 변경되었습니다. 최신 설정을 확인한 뒤 다시 저장해 주세요."],
  // 짧은 친구 초대의 권한·기한·응답 대기는 공개 안내만 사용한다.
  GOMOKU_INVITATION_FORBIDDEN: [403, "친구 초대는 대기 중인 방장의 현재 화면에서만 보낼 수 있습니다."],
  GOMOKU_INVITATION_NOT_FOUND: [404, "확인할 수 없는 오목 초대입니다."],
  GOMOKU_INVITATION_EXPIRED: [409, "초대 시간이 지났습니다. 다시 초대해 주세요."],
  GOMOKU_INVITATION_BUSY: [409, "이미 응답을 기다리는 초대가 있습니다. 잠시 후 다시 초대해 주세요."],
  GOMOKU_INVITATION_TARGET_UNAVAILABLE: [409, "지금은 이 친구를 초대할 수 없습니다. 접속·참가 상태를 확인해 주세요."],
  // 대국 상태 충돌은 최신 판을 다시 조회하고 금수·무르기는 구체적인 안내를 제공한다.
  GAME_STATE_CHANGED: [409, "대국 상태가 변경되었습니다. 현재 판을 확인하고 다시 시도해 주세요."],
  GAME_NOT_YOUR_TURN: [409, "상대의 차례입니다."],
  GAME_POSITION_OCCUPIED: [409, "이미 돌이 놓인 위치입니다."],
  GAME_FORBIDDEN_MOVE: [409, "흑돌의 3·3, 4·4, 장목 금수에는 착수할 수 없습니다."],
  GAME_UNDO_UNAVAILABLE: [409, "현재 무르기를 요청하거나 응답할 수 없습니다."],
  // 게임 점검과 숨김은 계정 인증 실패로 처리하지 않는다.
  CATALOG_GAME_NOT_FOUND: [404, "이용할 수 있는 게임을 찾을 수 없습니다."],
  CATALOG_MODE_NOT_FOUND: [404, "이용할 수 있는 게임 모드를 찾을 수 없습니다."],
  GAME_IMPLEMENTATION_UNAVAILABLE: [409, "현재 지원하지 않는 게임 구현 또는 모드입니다."],
  GAME_CATALOG_UNAVAILABLE: [503, "게임 목록을 일시적으로 확인할 수 없습니다."],
  GAME_UNAVAILABLE: [409, "현재 이 게임을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  // 채팅 연결 실패·재접속 제한은 로그인 실패나 계정 잠금으로 처리하지 않는다.
  CHAT_TICKET_RATE_LIMIT_EXCEEDED: [429, "채팅 접속 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  CHAT_SERVICE_UNAVAILABLE: [503, "채팅 서비스를 일시적으로 이용할 수 없습니다."],
  // 가입 전용 제한·장애는 로그인 실패나 계정 잠금으로 표시하지 않는다.
  SIGN_UP_RATE_LIMIT_EXCEEDED: [429, "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  // 운영자가 가입을 중단한 경우에도 인증 만료로 처리하지 않고 고정 안내를 전달한다.
  SIGN_UP_RESTRICTED: [403, "현재 회원가입이 제한되어 있습니다. 잠시 후 다시 시도해 주세요."],
  SIGN_UP_SERVICE_UNAVAILABLE: [503, "회원가입 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  USER_NOT_FOUND: [404, "사용자를 찾을 수 없습니다."],
  // 비밀번호 오입력을 세션 만료로 처리하지 않으며 내부 인증 오류 원문도 노출하지 않는다.
  CURRENT_PASSWORD_INVALID: [400, "현재 비밀번호가 올바르지 않습니다."],
  PASSWORD_UNCHANGED: [400, "새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요."],
  PASSWORD_CHANGE_RATE_LIMIT_EXCEEDED: [429, "비밀번호 변경 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  INVALID_CREDENTIALS: [401, "아이디 또는 비밀번호가 올바르지 않습니다."],
  LOGIN_SERVER_ERROR: [503, "서버 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  // 접속 제한과 게임 점검 코드에만 검증된 관리자 안내를 허용하며 내부 예외 메시지의 허용 목록은 유지한다.
  ACCESS_RESTRICTED: [401, "서버 점검 중입니다. 잠시 후 다시 로그인해 주세요."],
  ACCESS_POLICY_UNAVAILABLE: [503, "접속 설정을 반영하고 있습니다. 잠시 후 다시 시도해 주세요."],
  INVALID_REFRESH_TOKEN: [401, "로그인이 만료되었습니다. 다시 로그인해 주세요."],
  // 서버에서 해당 세션을 폐기했음을 전달하며 지연 응답으로 다른 요청의 새 쿠키를 삭제하지 않는다.
  REFRESH_TOKEN_REUSED: [401, "인증 정보 재사용이 감지되어 로그인 세션을 종료했습니다. 다시 로그인해 주세요."],
  INVALID_SESSION: [401, "로그인이 만료되었습니다. 다시 로그인해 주세요."],
  BROWSER_KEY_REQUIRED: [401, "이 브라우저의 로그인 키를 확인할 수 없습니다. 다시 로그인해 주세요."],
  BROWSER_PROOF_INVALID: [403, "요청의 브라우저 인증 정보를 확인할 수 없습니다."],
  BROWSER_PROOF_EXPIRED: [403, "요청 인증 정보가 만료되었습니다. 다시 시도해 주세요."],
  BROWSER_PROOF_REPLAYED: [403, "이미 처리한 요청 인증 정보입니다. 다시 시도해 주세요."],
  BROWSER_PROOF_RATE_LIMIT_EXCEEDED: [429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  BFF_AUTHENTICATION_REQUIRED: [403, "허용되지 않은 서버 연결입니다."],
  // 충돌 응답은 먼저 성공한 요청이 설정한 인증 쿠키를 유지하며 재시도를 안내한다.
  LOGIN_SESSION_CHANGED: [409, "로그인 상태가 변경되었습니다. 현재 상태를 다시 확인해 주세요."],
  // 유효한 자격 증명으로 확인한 중복 로그인은 기존 세션·쿠키를 유지한 채 사용자 선택을 기다린다.
  LOGIN_CONFIRMATION_REQUIRED: [409, "이미 다른 곳에서 로그인되어 있어요. 기존 로그인을 종료하고 계속할까요?"],
  LOGIN_RATE_LIMIT_EXCEEDED: [429, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  AUTH_SERVICE_UNAVAILABLE: [503, "로그인 서비스를 일시적으로 이용할 수 없습니다."],
  INVALID_AUTHENTICATION_REQUEST: [400, "인증 요청 형식이 올바르지 않습니다."],
  AUTHENTICATION_REQUIRED: [401, "로그인이 필요합니다."],
  INVALID_ACCESS_TOKEN: [401, "인증 정보를 갱신해야 합니다."],
  SESSION_REFRESH_REQUIRED: [401, "로그인 상태를 갱신해야 합니다."],
  ACCESS_DENIED: [403, "접근 권한이 없습니다."],
  INVALID_ORIGIN: [403, "허용되지 않은 요청입니다."],
  BACKEND_UNAVAILABLE: [503, "서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  BACKEND_TIMEOUT: [504, "응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."],
  INVALID_BACKEND_RESPONSE: [502, "서비스 응답을 처리할 수 없습니다."],
  SERVER_CONFIGURATION_ERROR: [500, "서버 설정을 확인할 수 없습니다."],
  INTERNAL_ERROR: [500, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."],
} as const;

type ErrorDetails = Readonly<{
  accessNotice?: string;
  gameNotice?: string;
  fieldErrors?: Readonly<Record<string, string>>;
  retryAfterSeconds?: number;
}>;

/** 요청 실패와 인증 만료를 구분하며 토큰·내부 주소·예외 원문을 보관하지 않는다. */
export class ApiError extends Error {
  readonly code: keyof typeof errors;
  readonly status: number;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly retryAfterSeconds?: number;
  // 서버 내부 진단에만 사용한다. 공개 오류 JSON에는 포함하지 않는다.
  loginAuditRecorded = false;

  constructor(code: keyof typeof errors, details: ErrorDetails = {}) {
    const [status, message] = errors[code];
    super(code === "ACCESS_RESTRICTED" ? parseOperationalNotice(details.accessNotice) ?? message
      : code === "GAME_UNAVAILABLE" ? parseOperationalNotice(details.gameNotice) ?? message : message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = details.fieldErrors;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

// 필드 오류는 평범한 객체의 짧은 문자열만 허용하여 응답 크기와 형태를 제한한다.
function parseFieldErrors(value: unknown): ErrorDetails["fieldErrors"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(value).slice(0, 20)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(key) && typeof message === "string" && message.length <= 300) {
      fields[key] = message;
    }
  }
  return fields;
}

/** Spring의 ProblemDetail을 제한된 공개 오류 정보로 변환한다. */
export function parseBackendError(
  status: number,
  body: unknown,
  retryAfter: string | null,
): ApiError {
  if (
    typeof body === "object" && body !== null && "code" in body
    && typeof body.code === "string" && Object.hasOwn(errors, body.code)
  ) {
    const code = body.code as keyof typeof errors;
    if (errors[code][0] === status) {
      const fields = "errors" in body ? body.errors : undefined;
      const fieldErrors = code === "VALIDATION_FAILED" ? parseFieldErrors(fields) : undefined;
      const seconds = retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : undefined;
      return new ApiError(code, {
        accessNotice: code === "ACCESS_RESTRICTED" && "detail" in body ? parseOperationalNotice(body.detail) : undefined,
        gameNotice: code === "GAME_UNAVAILABLE" && "detail" in body ? parseOperationalNotice(body.detail) : undefined,
        fieldErrors,
        retryAfterSeconds: (status === 429 || code === "LOGIN_SERVER_ERROR") && seconds && seconds <= 86_400 ? seconds : undefined,
      });
    }
  }
  return new ApiError(status >= 500 ? "BACKEND_UNAVAILABLE" : "INVALID_BACKEND_RESPONSE");
}

/** Route Handler에서만 사용하며 알 수 없는 예외의 메시지·스택은 응답에 포함하지 않는다. */
export function apiErrorResponse(error: unknown): Response {
  // cookies·no-store 접근으로 생긴 Next.js의 렌더링 제어 예외는 일반 500 응답으로 삼키지 않는다.
  unstable_rethrow(error);
  const failure = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR");
  const headers = new Headers({
    "Content-Type": "application/problem+json",
    "Cache-Control": "no-store",
  });
  if (failure.retryAfterSeconds) {
    headers.set("Retry-After", String(failure.retryAfterSeconds));
  }
  return Response.json(
    {
      type: "about:blank",
      title: failure.code,
      status: failure.status,
      detail: failure.message,
      code: failure.code,
      ...(failure.fieldErrors && { errors: failure.fieldErrors }),
      ...(failure.retryAfterSeconds && { retryAfterSeconds: failure.retryAfterSeconds }),
    },
    { status: failure.status, headers },
  );
}
