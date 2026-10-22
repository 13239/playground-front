import { preparePageExit, type PreparedPageExit } from "@/features/auth/client/browser-proof";
import { AuthRequestError } from "@/features/auth/client/api";
import { leaveRoom, openRoomPage } from "./api";

type RoomPage = Readonly<{ sessionId: string; roomId: number; membershipId: string; pageId: string; tabId: string }>;

/** 준비된 서명을 동기적으로 전송한다. 종료 이벤트 안에서 비동기 키·nonce·인증 잠금을 기다리지 않는다. */
function sendExit(request: PreparedPageExit): void {
  void fetch("/api/gomoku/rooms/lifecycle", { method: "POST", credentials: "same-origin", cache: "no-store",
    redirect: "error", keepalive: true, headers: request.headers, body: request.body }).catch(() => {});
}

/** Strict Mode의 효과 재실행도 같은 문서의 OPEN을 공유한다. 프레임워크 정리만으로 퇴장하지 않는다. */
export class RoomDeparture {
  private opened?: Promise<void>;
  private closeRequest?: PreparedPageExit;
  private leaveRequest?: PreparedPageExit;
  private departed = false;
  private lockReady?: Promise<void>;
  private releaseLock?: () => void;

  get pageId(): string { return this.page.pageId; }

  constructor(private readonly page: RoomPage) {}

  /** 계정별 Web Lock은 같은 브라우저의 두 탭을 거절하며, 서버의 tabId 소유권 검사가 다른 브라우저도 거절한다. */
  private claimLock(): Promise<void> {
    this.lockReady ??= new Promise<void>((resolve, reject) => {
      if (!navigator.locks) { resolve(); return; } // HTTP 개발 브라우저는 서버 소유권을 최종 기준으로 사용한다.
      void navigator.locks.request(`playground:gomoku:active:${this.page.sessionId}`, { ifAvailable: true }, async lock => {
        if (!lock) { reject(new AuthRequestError("다른 탭에서 오목 대국을 이용하고 있습니다.", 409, undefined, "ROOM_PAGE_IN_USE")); return; }
        if (this.departed) { resolve(); return; }
        await new Promise<void>(release => { this.releaseLock = release; resolve(); });
      }).catch(reject);
    });
    return this.lockReady;
  }

  async prepare(): Promise<number> {
    if (this.departed) return 0;
    await this.claimLock();
    this.opened ??= openRoomPage(this.page.sessionId, this.page.roomId, this.page.membershipId, this.page.pageId, this.page.tabId)
      .catch(error => { this.opened = undefined; throw error; });
    await this.opened;
    const [close, leave] = await Promise.all([
      preparePageExit({ ...this.page, action: "CLOSE" }), preparePageExit({ ...this.page, action: "LEAVE" }),
    ]);
    if (!this.departed) { this.closeRequest = close; this.leaveRequest = leave; }
    return Math.min(close.validUntil, leave.validUntil);
  }

  /** SPA 뒤로가기는 즉시 퇴장, 문서 종료는 서버에서 새로고침 복귀를 짧게 기다린다. */
  exit(closing: boolean): void {
    if (this.departed) return;
    this.departed = true;
    this.releaseLock?.();
    const request = closing ? this.closeRequest : this.leaveRequest;
    if (request && performance.now() < request.validUntil) sendExit(request);
    else if (!closing) {
      // SPA는 문서가 살아 있으므로 준비가 끝나기 전 뒤로가기도 일반 인증 경로로 완료한다.
      void (this.opened ?? Promise.resolve()).catch(() => {}).then(() =>
        leaveRoom(this.page.sessionId, this.page.roomId, this.page.membershipId, this.page.pageId)).catch(() => {});
    }
  }

  /** reload는 서버 참가를 유지하지만 이전 문서의 Web Lock은 새 문서에 즉시 양도한다. */
  releaseForReload(): void { this.releaseLock?.(); }

  // 명시적 나가기가 성공하면 뒤따르는 라우트 정리·pagehide가 같은 퇴장을 다시 전송하지 않는다.
  complete(): void { this.departed = true; this.releaseLock?.(); }
  get hasDeparted(): boolean { return this.departed; }
}
