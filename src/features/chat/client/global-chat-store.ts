import { createUuidV4 } from "@/lib/client/uuid";
import { AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { authRetryDelay } from "@/features/auth/client/request-cooldown";
import { chatConnectionError, connectChat } from "./connection";
import { chatRecovery } from "./recovery";
import { reportConnectionIssue } from "@/lib/client/connection-diagnostics";
import { mergeMessages, compareChatTime } from "./message-window";
import { parseChatEvent, sendChatFrame, validatedChatContent,
  type ChatEvent, type PublicChatMessage, type PublicChatUser, type PublicChatProfile, type ChatDestination } from "./protocol";

const HISTORY_LIMIT = 30;
const PRESENCE_LIMIT = 50;
const RETRY_MAX_MS = 15_000;
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 15_000;
const MAX_PENDING = 20;
const MAX_SEND_ATTEMPTS = 3;
const MAX_AUTH_RECOVERY_ATTEMPTS = 3;
const ticketIssueCodes = new Set([
  "CHAT_TICKET_INVALID", "CHAT_TICKET_RATE_LIMIT_EXCEEDED", "CHAT_SERVICE_UNAVAILABLE", "BACKEND_TIMEOUT",
  "BACKEND_UNAVAILABLE", "AUTH_SERVICE_UNAVAILABLE", "INVALID_BACKEND_RESPONSE", "SERVER_CONFIGURATION_ERROR", "NETWORK_UNAVAILABLE",
]);
type Timer = ReturnType<typeof setTimeout>;

export type PendingChatMessage = Readonly<{
  clientMessageId: string;
  content: string;
  state: "queued" | "unconfirmed" | "failed";
  attempts: number;
}>;
export type ChatConnectionState = "login" | "connecting" | "connected" | "reconnecting" | "expired" | "error";
export type ChatActionResult = Readonly<{ ok: boolean; message?: string }>;
export type ChatSnapshot = Readonly<{
  sessionId: string | null;
  state: ChatConnectionState;
  error?: string;
  retryAt?: number;
  messages: PublicChatMessage[];
  pending: PendingChatMessage[];
  history: "idle" | "loading" | "more" | "done" | "error";
  viewingOlder: boolean;
  hasNewMessages: boolean;
  onlineCount: number | null;
  onlineUsers: PublicChatUser[];
  onlineNextCursor: string | null;
  onlineLoading: boolean;
}>;

function emptySnapshot(): ChatSnapshot {
  return { sessionId: null, state: "login", messages: [], pending: [], history: "idle",
    viewingOlder: false, hasNewMessages: false, onlineCount: null, onlineUsers: [],
    onlineNextCursor: null, onlineLoading: false };
}

// SSR와 인증 재확인 중에는 이전 사용자의 메시지·미확정 전송을 화면에 노출하지 않는다.
export const EMPTY_CHAT = emptySnapshot();

/** WebSocket이라는 외부 상태를 한 곳에서 관리한다. 여러 패널은 같은 유한 메시지 창과 연결을 공유한다. */
export class GlobalChatStore {
  // 기존 공용 채팅을 기본값으로 유지하되 대기실은 방별 독립 store로 재접속·중복 제거를 공유한다.
  constructor(private readonly destination: ChatDestination = { scope: "GLOBAL" }) {}
  private snapshot = emptySnapshot();
  private readonly listeners = new Set<() => void>();
  private socket: WebSocket | null = null;
  private connectionClose?: () => void;
  private removeListeners?: () => void;
  private abort?: AbortController;
  private generation = 0;
  private retries = 0;
  // 같은 세션의 반복 인증 실패는 전역 로그인 확인을 무한히 재시작하지 않는다.
  private authFailures = 0;
  private reconnectAt = 0;
  private retryTimer?: Timer;
  private pingTimer?: ReturnType<typeof setInterval>;
  private pongTimer?: Timer;
  private historyTimer?: Timer;
  private presenceTimer?: Timer;
  private recoveryTimer?: Timer;
  private statusTimer?: Timer;
  private readonly pendingTimers = new Map<string, Timer>();
  private historyRequest?: { id: string; before: string | null; items: PublicChatMessage[]; live: PublicChatMessage[]; outsideWindow?: boolean };
  private presenceRequest?: { id: string; cursor: string | null };
  private statusRequest?: { clientMessageId: string; manual: boolean };
  private nextCursor: string | null = null;
  private failedHistoryBefore: string | null = null;
  private lastHistoryAt = Number.NEGATIVE_INFINITY;
  private lastPresenceAt = Number.NEGATIVE_INFINITY;
  private lastStatusAt = Number.NEGATIVE_INFINITY;
  private lastSendAt = Number.NEGATIVE_INFINITY;
  private blockedUntil = 0;
  // 홈 방문별 첫 접속의 서버 시각을 보존한다. 네트워크 재연결·닉네임 변경은 이 경계를 옮기지 않는다.
  private visibleAfter?: string;
  private readonly authorProfiles = new Map<string, PublicChatProfile>();

  getSnapshot = (): ChatSnapshot => this.snapshot;
  getServerSnapshot = (): ChatSnapshot => EMPTY_CHAT;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<ChatSnapshot>): void {
    if (patch.messages) {
      // 늦은 Kafka 방송·이력 응답도 더 최신의 프로필 세대를 되돌릴 수 없다.
      for (const message of patch.messages) {
        if (message.authorKey && message.profileRevision !== undefined) this.rememberProfile({
          authorKey: message.authorKey, nickname: message.nickname, avatarId: message.avatarId, revision: message.profileRevision,
        });
      }
      patch = { ...patch, messages: patch.messages.map(message => {
        const profile = message.authorKey ? this.authorProfiles.get(message.authorKey) : undefined;
        return profile && profile.revision >= (message.profileRevision ?? 0)
          && (message.nickname !== profile.nickname || message.avatarId !== profile.avatarId || message.profileRevision !== profile.revision)
          ? { ...message, nickname: profile.nickname, avatarId: profile.avatarId, profileRevision: profile.revision } : message;
      }) };
    }
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  connect = (sessionId: string): (() => void) => {
    this.disconnect();
    if (this.snapshot.sessionId !== sessionId) {
      this.visibleAfter = undefined;
      this.authorProfiles.clear();
      this.snapshot = emptySnapshot();
      this.nextCursor = null;
      this.retries = 0;
      this.authFailures = 0;
      this.reconnectAt = 0;
    }
    const controller = new AbortController();
    this.abort = controller;
    const generation = this.generation;
    const exhausted = this.authFailures >= MAX_AUTH_RECOVERY_ATTEMPTS;
    this.update({ sessionId, state: exhausted ? "error" : "connecting",
      error: exhausted ? "채팅 접속 인증을 반복해서 확인하지 못했어요. 잠시 후 다시 연결해 주세요." : undefined,
      retryAt: exhausted ? this.retryDeadline() : undefined,
      history: "idle", viewingOlder: false, hasNewMessages: false,
      pending: this.snapshot.pending.map((item) => ({ ...item, state: "unconfirmed" })),
      onlineCount: null, onlineUsers: [], onlineNextCursor: null, onlineLoading: false });
    if (!exhausted && generation === this.generation && !controller.signal.aborted) void this.establish(generation, sessionId, controller.signal);
    // 이전 화면의 늦은 정리가 새 세션의 연결을 닫지 않도록 해당 연결 수명만 정리한다.
    return () => { if (this.abort === controller) this.disconnect(); };
  };

  clear = (): void => {
    this.disconnect();
    this.visibleAfter = undefined;
    this.authorProfiles.clear();
    this.snapshot = emptySnapshot();
    for (const listener of this.listeners) listener();
  };

  disconnect = (): void => {
    this.generation++;
    const controller = this.abort;
    this.abort = undefined;
    controller?.abort();
    this.cancelConnection();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  };

  private cancelConnection(): void {
    this.removeListeners?.();
    this.removeListeners = undefined;
    this.connectionClose?.();
    this.connectionClose = undefined;
    this.socket = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
    // PONG 대기도 연결과 함께 정리해 이전 소켓의 응답 기한이 다음 연결에 남지 않게 한다.
    for (const timer of [this.pongTimer, this.historyTimer, this.presenceTimer, this.recoveryTimer, this.statusTimer]) {
      if (timer) clearTimeout(timer);
    }
    // 타이머는 연결 수명에 묶되 같은 로그인 세션의 미확정 UUID와 본문은 재연결에 유지한다.
    for (const timer of this.pendingTimers.values()) clearTimeout(timer);
    this.pendingTimers.clear();
    this.pingTimer = undefined;
    this.pongTimer = undefined;
    this.historyTimer = this.presenceTimer = this.recoveryTimer = this.statusTimer = undefined;
    this.historyRequest = this.presenceRequest = this.statusRequest = undefined;
    this.lastHistoryAt = this.lastPresenceAt = this.lastStatusAt = this.lastSendAt = Number.NEGATIVE_INFINITY;
    this.blockedUntil = 0;
  }

  private async establish(generation: number, sessionId: string, signal: AbortSignal): Promise<void> {
    if (generation !== this.generation || signal.aborted) return;
    // 같은 세션의 인증 재확인으로 효과가 다시 연결돼도 기존 제한 대기 시간은 유지한다.
    const remaining = this.reconnectAt - performance.now();
    if (remaining > 0) {
      this.setDisconnected("reconnecting");
      if (generation !== this.generation || signal.aborted) return;
      this.retryTimer = setTimeout(() => { void this.establish(generation, sessionId, signal); }, remaining);
      return;
    }
    // 실제 연결 준비와 다음 시도까지의 대기를 구분해 진행 중인 연결을 중복 재시도하지 않게 한다.
    this.update({ state: "connecting", retryAt: undefined });
    if (generation !== this.generation || signal.aborted) return;
    try {
      const connection = await connectChat(sessionId, signal, this.destination, serverTime => {
        // 소켓 연결에 실패해 다시 시도해도 이번 홈 방문의 첫 티켓 발급 경계는 앞으로 옮기지 않는다.
        if (generation === this.generation && !signal.aborted && this.destination.scope === "GLOBAL") this.visibleAfter ??= serverTime;
      });
      if (generation !== this.generation || signal.aborted) { connection.close(); return; }
      // 브라우저 시계 오차 대신 서버 발급 시각으로 홈의 이전 메시지를 걸러낸다. 방 채팅의 입장 경계는 서버가 관리한다.
      if (this.destination.scope === "GLOBAL") this.visibleAfter ??= connection.serverTime;
      this.connectionClose = connection.close;
      this.socket = connection.socket;
      const socket = connection.socket;
      const connectedAt = performance.now();
      let lastPingAt = connectedAt;
      let lastResumeAt = connectedAt;
      const onMessage = (event: MessageEvent<unknown>) => {
        if (generation !== this.generation || this.socket !== socket) return;
        const frame = parseChatEvent(event.data, this.destination);
        if (frame) this.receive(frame);
      };
      // 종료 이벤트가 없는 통신 단절도 같은 정리·재접속 경로로 처리한다. 자동 재접속끼리는 소켓으로 구분한다.
      const onConnectionLost = (closeCode?: number, closeReason = "") => {
        if (generation !== this.generation || this.socket !== socket || signal.aborted) return;
        if (performance.now() - connectedAt >= 30_000) { this.retries = 0; this.authFailures = 0; }
        this.cancelConnection();
        // 종료 코드만으로 판단하지 않고 서버의 고정 오류 식별자로 티켓·세션·방 권한을 구분한다.
        this.recover(chatConnectionError(closeCode ?? 1006, closeReason), generation, sessionId, signal);
      };
      const onClose = (event: CloseEvent) => onConnectionLost(event.code, event.reason);
      const ping = () => {
        // 복귀 직후의 확인과 주기 PING도 서버의 최소 1초 간격·단일 PONG 대기를 공유한다.
        if (generation !== this.generation || this.socket !== socket || signal.aborted || this.pongTimer !== undefined
          || performance.now() - lastPingAt < 1000) return;
        lastPingAt = performance.now();
        const timer = setTimeout(() => {
          // 취소 직전 실행 대기 중이던 콜백도 이미 응답한 PING이나 다음 PING에 영향을 주지 않는다.
          if (this.pongTimer === timer) onConnectionLost();
        }, PONG_TIMEOUT_MS);
        this.pongTimer = timer;
        // 송신 버퍼 초과·소켓 오류는 PONG 기한까지 기다리지 않고 기존 지수 지연으로 재접속한다.
        if (!sendChatFrame(socket, { type: "PING" })) onConnectionLost();
      };
      const onResume = () => {
        if (document.visibilityState !== "visible" || performance.now() - lastResumeAt < 30_000
          || generation !== this.generation || this.socket !== socket) return;
        lastResumeAt = performance.now();
        // 절전 뒤에도 정상 소켓은 유지하고 응답 여부만 확인한다. 과거 메시지 탐색 위치는 바꾸지 않는다.
        ping();
        if (!this.snapshot.viewingOlder) this.loadHistory();
      };
      socket.addEventListener("message", onMessage);
      socket.addEventListener("close", onClose);
      document.addEventListener("visibilitychange", onResume);
      window.addEventListener("focus", onResume);
      window.addEventListener("online", onResume);
      this.removeListeners = () => {
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("close", onClose);
        document.removeEventListener("visibilitychange", onResume);
        window.removeEventListener("focus", onResume);
        window.removeEventListener("online", onResume);
      };
      this.reconnectAt = 0;
      this.update({ state: "connected", error: undefined, retryAt: undefined });
      for (const data of connection.takeBufferedFrames()) onMessage({ data } as MessageEvent<string>);
      // 상태 구독자가 로그아웃·계정 전환을 처리했다면 이전 연결에 새 타이머를 설치하지 않는다.
      if (generation !== this.generation || this.socket !== socket || signal.aborted) return;
      // 연결이 인증 직후 종료된 경우 close 이벤트를 놓치지 않고 바로 재접속한다.
      if (socket.readyState !== WebSocket.OPEN) {
        onConnectionLost();
        return;
      }
      // 서버는 90초 입력 대기 제한을 적용하므로 25초 주기의 경량 PING을 보낸다.
      // PONG에는 요청 ID가 없으므로 한 연결에서 동시에 기다리는 PING은 하나로 제한한다.
      this.pingTimer = setInterval(ping, PING_INTERVAL_MS);
      // 서버가 로그인 경계를 강제한 최근 메시지만 재조회해 Kafka 전파 누락도 복구한다.
      this.loadHistory();
      this.scheduleRecovery(700);
    } catch (error) {
      if (generation !== this.generation || signal.aborted) return;
      // 인증 후 이력 조회 등에서 예외가 나더라도 이전 WebSocket을 닫고 재시도한다.
      this.cancelConnection();
      this.recover(error, generation, sessionId, signal);
    }
  }

  /** 서버가 세션 무효를 명시할 때만 전역 인증을 확인하고 나머지는 채팅의 복구 예산 안에서 처리한다. */
  private recover(error: unknown, generation: number, sessionId: string, signal: AbortSignal): void {
    if (generation !== this.generation || signal.aborted) return;
    const recovery = chatRecovery(error);
    // 원문 오류·티켓·대화는 전달하지 않고 복구를 결정한 고정 단계와 코드만 남긴다.
    if (error instanceof AuthRequestError && error.code !== "LOGIN_SESSION_CHANGED") {
      const code = error.code ?? "CHAT_CONNECTION_UNAVAILABLE";
      const phase = ticketIssueCodes.has(code) ? "chat-ticket" : recovery === "session" || recovery === "stop" ? "chat-authentication" : "chat-connection";
      reportConnectionIssue(phase, code, error.status);
    } else if (!(error instanceof AuthRequestError) && !(error instanceof DOMException && error.name === "AbortError")) {
      reportConnectionIssue("chat-connection");
    }
    if (recovery === "session" || recovery === "ticket") this.authFailures++;
    const exhausted = this.authFailures >= MAX_AUTH_RECOVERY_ATTEMPTS;
    if (recovery === "stop" || exhausted) {
      this.reconnectAt = Math.max(this.reconnectAt, performance.now() + RETRY_MAX_MS);
      this.setDisconnected("error", exhausted
        ? "채팅 접속 인증을 반복해서 확인하지 못했어요. 잠시 후 다시 연결해 주세요."
        : error instanceof AuthRequestError ? error.message : "채팅에 연결하지 못했습니다. 잠시 후 다시 연결해 주세요.");
    } else if (recovery === "session") {
      // 같은 세션이 BFF에서 다시 확인돼도 곧바로 채팅 인증을 반복하지 않도록 대기를 먼저 보존한다.
      this.deferRetry();
      this.setDisconnected("expired");
    } else {
      this.reconnect(generation, sessionId, signal, error instanceof AuthRequestError && error.status === 429 ? authRetryDelay(error) : 0);
    }
    // 실제 세션 오류는 마지막 시도에서도 확인하되 이후 같은 세션의 자동 채팅 재연결은 중단한다.
    if (recovery === "session" && generation === this.generation && !signal.aborted) revalidateAuthSession();
  }

  private setDisconnected(state: ChatConnectionState, error?: string): void {
    this.update({ state, error, retryAt: this.retryDeadline(), onlineCount: null, onlineUsers: [], onlineNextCursor: null,
      onlineLoading: false, pending: this.snapshot.pending.map((item) => ({ ...item, state: "unconfirmed" })) });
  }

  /** 내부 재접속 시계는 유지하고 화면에는 브라우저 복귀 후에도 계산할 수 있는 공개 종료 시각만 제공한다. */
  private retryDeadline(): number | undefined {
    const remaining = this.reconnectAt - performance.now();
    return remaining > 0 ? Date.now() + remaining : undefined;
  }

  private deferRetry(retryAfter = 0): number {
    // 티켓 발급·연결 제한의 Retry-After는 일반 지수 재접속 상한보다 우선한다.
    const delay = Math.max(retryAfter, Math.min(RETRY_MAX_MS, 1000 * 2 ** Math.min(this.retries++, 4)));
    this.reconnectAt = Math.max(this.reconnectAt, performance.now() + delay + Math.floor(Math.random() * 400));
    return this.reconnectAt - performance.now();
  }

  private reconnect(generation: number, sessionId: string, signal: AbortSignal, retryAfter = 0): void {
    if (generation !== this.generation || signal.aborted) return;
    const delay = this.deferRetry(retryAfter);
    this.setDisconnected("reconnecting");
    // 구독자가 오류 처리 중 로그아웃·계정 전환을 완료했다면 이전 세션의 재시도를 새로 예약하지 않는다.
    if (generation !== this.generation || signal.aborted) return;
    this.retryTimer = setTimeout(() => { void this.establish(generation, sessionId, signal); }, delay);
  }

  private loadHistory(before: string | null = null): boolean {
    const now = performance.now();
    // 서버의 CHAT_HISTORY 500ms 제한을 넘기면 WebSocket 자체가 종료된다.
    if (this.historyRequest || now - this.lastHistoryAt < 650 || now < this.blockedUntil) return false;
    const id = createUuidV4();
    if (!sendChatFrame(this.socket, { type: "CHAT_HISTORY", ...this.destination, requestId: id,
      limit: HISTORY_LIMIT, ...(before ? { before } : {}) })) return false;
    this.lastHistoryAt = now;
    this.historyRequest = { id, before, items: [], live: [] };
    this.historyTimer = setTimeout(() => {
      if (this.historyRequest?.id !== id) return;
      this.historyRequest = undefined;
      this.failedHistoryBefore = before;
      this.update({ history: "error" });
    }, 15_000);
    this.update({ history: "loading", viewingOlder: Boolean(before) || this.snapshot.viewingOlder });
    return true;
  }

  loadOlder = (): boolean => Boolean(this.nextCursor) && this.loadHistory(this.nextCursor);
  returnToLatest = (): boolean => this.loadHistory();
  retryHistory = (): boolean => this.loadHistory(this.failedHistoryBefore);
  // 수동 재연결도 서버가 정한 대기 시간을 건너뛰지 않는다.
  retry = (): void => {
    if (this.snapshot.sessionId && performance.now() >= this.reconnectAt) {
      this.authFailures = 0;
      this.connect(this.snapshot.sessionId);
    }
  };

  loadPresence = (cursor: string | null = null): boolean => {
    // 방 인원은 MySQL 참가 상태에서 표시하며 공용 채팅 접속자 목록과 섞지 않는다.
    if (this.destination.scope !== "GLOBAL") return false;
    const now = performance.now();
    // 서버는 접속자 목록 요청 간격이 1초 미만이면 연결을 종료하므로 클라이언트에서도 제한한다.
    if (this.presenceRequest || now - this.lastPresenceAt < 1200 || now < this.blockedUntil) return false;
    const id = createUuidV4();
    if (!sendChatFrame(this.socket, { type: "PRESENCE_GET", requestId: id, onlineLimit: PRESENCE_LIMIT,
      ...(cursor ? { onlineCursor: cursor } : {}) })) return false;
    this.lastPresenceAt = now;
    this.presenceRequest = { id, cursor };
    this.presenceTimer = setTimeout(() => {
      if (this.presenceRequest?.id !== id) return;
      this.presenceRequest = undefined;
      this.update({ onlineLoading: false });
    }, 10_000);
    this.update({ onlineLoading: true });
    return true;
  };

  sendMessage = (input: string): ChatActionResult => {
    const content = validatedChatContent(input);
    if (!content) return { ok: false, message: "메시지는 1~1000자이며 제어 문자와 과도한 길이는 사용할 수 없어요." };
    if (this.snapshot.pending.length >= MAX_PENDING) return { ok: false, message: "이전 메시지의 전송 상태를 먼저 확인해 주세요." };
    if (performance.now() - this.lastSendAt < 250 || performance.now() < this.blockedUntil) {
      return { ok: false, message: "잠시 후 메시지를 보내 주세요." };
    }
    const pending: PendingChatMessage = { clientMessageId: createUuidV4(), content, state: "queued", attempts: 0 };
    return this.transmit(pending) ? { ok: true }
      : { ok: false, message: "채팅 연결을 확인한 뒤 다시 전송해 주세요." };
  };

  private transmit(item: PendingChatMessage): boolean {
    if (!sendChatFrame(this.socket, { type: "CHAT_SEND", ...this.destination,
      clientMessageId: item.clientMessageId, content: item.content })) return false;
    this.lastSendAt = performance.now();
    // Kafka 접수는 MongoDB 저장 확정이 아니므로 서버의 CHAT_MESSAGE/상태 조회까지 전송 중으로 표시한다.
    const pending: PendingChatMessage = { ...item, state: "queued", attempts: item.attempts + 1 };
    this.update({ pending: [...this.snapshot.pending.filter((value) => value.clientMessageId !== item.clientMessageId), pending] });
    const previous = this.pendingTimers.get(item.clientMessageId);
    if (previous) clearTimeout(previous);
    // Kafka 접수 후 DB 확정 이벤트가 오지 않을 때 전송 완료로 오인하지 않는다.
    this.pendingTimers.set(item.clientMessageId, setTimeout(() => {
      this.pendingTimers.delete(item.clientMessageId);
      this.markPending(item.clientMessageId, "unconfirmed");
      this.scheduleRecovery();
    }, 30_000));
    return true;
  }

  private markPending(id: string, state: PendingChatMessage["state"]): void {
    this.update({ pending: this.snapshot.pending.map((item) => item.clientMessageId === id ? { ...item, state } : item) });
  }

  private confirm(message: PublicChatMessage): void {
    if (!message.clientMessageId) return;
    const timer = this.pendingTimers.get(message.clientMessageId);
    if (timer) clearTimeout(timer);
    this.pendingTimers.delete(message.clientMessageId);
    this.update({ pending: this.snapshot.pending.filter((item) => item.clientMessageId !== message.clientMessageId) });
  }

  retryMessage = (id: string): void => {
    const item = this.snapshot.pending.find((value) => value.clientMessageId === id);
    if (item && item.state !== "queued") this.queryStatus(id, true);
  };

  private scheduleRecovery(delay = 700): void {
    if (this.recoveryTimer || this.snapshot.state !== "connected") return;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = undefined;
      const item = this.snapshot.pending.find((value) => value.state === "unconfirmed");
      if (!item) return;
      if (!this.queryStatus(item.clientMessageId, false)) this.scheduleRecovery(700);
    }, Math.max(delay, this.blockedUntil - performance.now() + 50));
  }

  private queryStatus(id: string, manual: boolean): boolean {
    const now = performance.now();
    if (this.statusRequest || now - this.lastStatusAt < 650 || now < this.blockedUntil) return false;
    if (!sendChatFrame(this.socket, { type: "CHAT_STATUS", ...this.destination, clientMessageId: id })) return false;
    this.lastStatusAt = now;
    this.statusRequest = { clientMessageId: id, manual };
    this.statusTimer = setTimeout(() => {
      if (this.statusRequest?.clientMessageId !== id) return;
      this.statusRequest = undefined;
      this.markPending(id, "failed");
      this.scheduleRecovery();
    }, 10_000);
    return true;
  }

  private receive(frame: ChatEvent): void {
    switch (frame.type) {
      case "CHAT_PROFILE_CHANGED":
        if (this.rememberProfile(frame.profile)) this.update({ messages: this.snapshot.messages });
        break;
      case "CHAT_MESSAGE":
        if (!this.visible(frame.message)) break;
        this.confirm(frame.message);
        // 이력 쿼리 이후 도착한 방송은 페이지 완료 시에도 유지해 조회와 실시간 수신 사이의 경합을 막는다.
        if (this.historyRequest && !this.historyRequest.before) {
          this.historyRequest.live = mergeMessages(this.historyRequest.live, [frame.message]);
        }
        this.update({ messages: mergeMessages(this.snapshot.messages, [frame.message], this.snapshot.viewingOlder ? "oldest" : "latest"),
          hasNewMessages: this.snapshot.hasNewMessages || this.snapshot.viewingOlder });
        break;
      case "CHAT_HISTORY_ITEM":
        if (frame.requestId === this.historyRequest?.id && this.historyRequest.items.length < HISTORY_LIMIT) {
          if (!this.visible(frame.message)) { this.historyRequest.outsideWindow = true; break; }
          this.historyRequest.items.push(frame.message);
          this.confirm(frame.message);
        }
        break;
      case "CHAT_HISTORY_END": {
        const request = this.historyRequest;
        if (!request || frame.requestId !== request.id) break;
        this.historyRequest = undefined;
        if (this.historyTimer) clearTimeout(this.historyTimer);
        this.historyTimer = undefined;
        this.nextCursor = request.outsideWindow ? null : frame.nextCursor;
        // 한 페이지를 모아서 한 번 정렬한다. 과거 탐색 중 새 방송이 오래된 페이지를 밀어내지 않는다.
        this.update({ messages: mergeMessages(request.before ? this.snapshot.messages : request.live, request.items, request.before ? "oldest" : "latest"),
          history: frame.hasMore && !request.outsideWindow ? "more" : "done", viewingOlder: Boolean(request.before),
          hasNewMessages: request.before ? this.snapshot.hasNewMessages : false });
        break;
      }
      case "PRESENCE_CHANGED": this.update({ onlineCount: frame.onlineCount }); break;
      case "PRESENCE_SNAPSHOT": {
        const request = this.presenceRequest;
        if (!request || request.id !== frame.requestId) break;
        this.presenceRequest = undefined;
        if (this.presenceTimer) clearTimeout(this.presenceTimer);
        this.presenceTimer = undefined;
        // 이전 페이지의 요청 시각은 보존하여 연달아 조회할 때 서버 제한을 지킨다.
        this.update({ onlineCount: frame.onlineCount, onlineUsers: request.cursor
          ? [...this.snapshot.onlineUsers, ...frame.onlineUsers] : frame.onlineUsers,
        onlineNextCursor: frame.nextOnlineCursor, onlineLoading: false });
        break;
      }
      case "CHAT_STATUS_RESULT": {
        const request = this.statusRequest;
        if (!request || request.clientMessageId !== frame.clientMessageId) break;
        this.statusRequest = undefined;
        if (this.statusTimer) clearTimeout(this.statusTimer);
        this.statusTimer = undefined;
        const item = this.snapshot.pending.find((value) => value.clientMessageId === frame.clientMessageId);
        if (frame.stored && frame.message) {
          this.confirm(frame.message);
          if (!this.visible(frame.message)) { this.scheduleRecovery(); break; }
          if (this.historyRequest && !this.historyRequest.before) {
            this.historyRequest.live = mergeMessages(this.historyRequest.live, [frame.message]);
          }
          this.update({ messages: mergeMessages(this.snapshot.messages, [frame.message], this.snapshot.viewingOlder ? "oldest" : "latest") });
        } else if (item) {
          // 상태 확인 후에만 같은 UUID·본문으로 재전송한다. 자동 전송은 최대 세 번이고 이후에는 사용자 입력을 기다린다.
          if ((item.attempts < MAX_SEND_ATTEMPTS || request.manual) && performance.now() - this.lastSendAt >= 250) {
            if (!this.transmit(item)) this.markPending(item.clientMessageId, "failed");
          } else this.markPending(item.clientMessageId, "failed");
        }
        this.scheduleRecovery();
        break;
      }
      case "CHAT_ERROR":
        this.blockedUntil = Math.max(this.blockedUntil, performance.now() + frame.retryAfterMillis);
        if (frame.operation === "CHAT_HISTORY" && this.historyRequest && frame.requestId === this.historyRequest.id) {
          this.failedHistoryBefore = this.historyRequest.before;
          this.historyRequest = undefined;
          if (this.historyTimer) clearTimeout(this.historyTimer);
          this.update({ history: "error" });
        }
        if (frame.operation === "PRESENCE_GET" && this.presenceRequest && frame.requestId === this.presenceRequest.id) {
          this.presenceRequest = undefined;
          if (this.presenceTimer) clearTimeout(this.presenceTimer);
          this.update({ onlineLoading: false });
        }
        if (frame.operation === "CHAT_STATUS" && this.statusRequest && frame.clientMessageId === this.statusRequest.clientMessageId) {
          this.statusRequest = undefined;
          if (this.statusTimer) clearTimeout(this.statusTimer);
        }
        if (frame.operation === "CHAT_SEND" && frame.clientMessageId) {
          const timer = this.pendingTimers.get(frame.clientMessageId);
          if (timer) clearTimeout(timer);
          this.pendingTimers.delete(frame.clientMessageId);
          const item = this.snapshot.pending.find((value) => value.clientMessageId === frame.clientMessageId);
          if (item) this.markPending(item.clientMessageId, item.attempts >= MAX_SEND_ATTEMPTS ? "failed" : "unconfirmed");
        }
        this.scheduleRecovery(frame.retryAfterMillis + 100);
        break;
      case "CHAT_ACCEPTED": break;
      case "PONG":
        // 유효한 현재 소켓의 PONG만 응답 대기를 끝낸다. 다른 방송 수신은 응답 기한을 연장하지 않는다.
        if (this.pongTimer !== undefined) clearTimeout(this.pongTimer);
        this.pongTimer = undefined;
        break;
    }
  }

  /** 홈을 떠나면 store를 비우고 새 방문의 첫 서버 시각 이후 접수된 글만 표시한다. */
  private visible(message: PublicChatMessage): boolean {
    return this.destination.scope !== "GLOBAL" || this.visibleAfter !== undefined && compareChatTime(message.createdAt, this.visibleAfter) > 0;
  }

  private rememberProfile(profile: PublicChatProfile): boolean {
    const previous = this.authorProfiles.get(profile.authorKey);
    if (previous && previous.revision >= profile.revision) return false;
    this.authorProfiles.delete(profile.authorKey);
    this.authorProfiles.set(profile.authorKey, profile);
    // 화면 500개와 이력·실시간 임시 버퍼를 합친 수보다 크게 제한하고 무제한 작성자 캐시는 만들지 않는다.
    if (this.authorProfiles.size > 1024) this.authorProfiles.delete(this.authorProfiles.keys().next().value!);
    return true;
  }
}
