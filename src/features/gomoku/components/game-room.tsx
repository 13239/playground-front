"use client";

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import type { WaitingRoom } from "../waiting-contracts";
import type { GameAction, MatchState } from "../game-contracts";
import { RoomDialog } from "./room-dialog";
import { GameBoard } from "./game-board";
import { ActiveTurnCountdown, CountdownSeconds, GameClockProvider, PopupTurn, PlayerTurnTimer } from "./game-clock";
import { useGamePopup } from "../client/use-game-popup";
import { GameResultDialog } from "./game-result-dialog";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./game-room.module.css";

const reasons = { FIVE: "다섯 돌을 완성했어요.", BOARD_FULL: "판이 모두 채워져 무승부예요.", RESIGN: "기권으로 대국이 끝났어요.",
  DISCONNECT: "연결을 복구하지 못해 대국이 끝났어요.", INTERRUPTED: "양쪽 연결이 끊겨 대국을 중단했어요." } as const;

/** 같은 방 안에서 추첨·판·결과·재대국을 표시한다. 모든 변경은 서버 응답을 확인한 뒤 반영한다. */
export function GameRoom({ room, receivedAt, pending, error, reconnectAttempt, connectionLost, onAction, onLeave, onRecover, leaveConfirmation }: {
  room: WaitingRoom & { game: MatchState }; receivedAt: number; pending: boolean; error: string; reconnectAttempt: number; connectionLost: boolean;
  onAction: (action: GameAction) => void; onLeave: () => void; onRecover: () => void;
  // 방 컨트롤러의 퇴장 확인·오류·중복 요청 방지를 실제 대국이 표시되는 문서에서 그대로 사용한다.
  leaveConfirmation?: ReactNode;
}) {
  const game = room.game;
  const self = room.participants.find(player => player.self)!;
  // 재대국은 팝업을 유지하고 확인·결과 창의 선택만 해당 대국 식별자에 묶는다.
  const [resignMatchId, setResignMatchId] = useState<number>();
  const [dismissedResultId, setDismissedResultId] = useState<number>();
  const confirmResign = resignMatchId === game.id;
  const resultDismissed = dismissedResultId === game.id;
  const undoVisible = game.phase === "PLAYING" && game.undoSeat > 0;
  const undoTitleId = useId();
  const undoDescriptionId = useId();
  const undoDialogRef = useRef<HTMLElement>(null);
  const popup = useGamePopup(styles.popupDocument);
  // 최신 명령 콜백만 교체하고 판에는 안정적인 함수 참조를 내려 주기 조회 시 전체 셀 렌더링을 막는다.
  const moveActionRef = useRef(onAction);
  useEffect(() => { moveActionRef.current = onAction; }, [onAction]);
  const move = useCallback((x: number, y: number) => moveActionRef.current({ action: "MOVE", x, y }), []);
  // 무르기 팝업이 표시되면 실제 대국 문서(원래 화면 또는 별도 팝업)의 응답 버튼으로 포커스를 옮긴다.
  useEffect(() => {
    if (!undoVisible) return;
    const dialog = undoDialogRef.current;
    if (game.undoSeat === self.seat) dialog?.focus({ preventScroll: true });
    else dialog?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [undoVisible, game.undoSeat, game.undoDeadline, self.seat, popup.container]);
  // 현재 차례와 만료 여부는 서버에서 검증한다. UI 시계의 초 변화는 하위 컴포넌트 안에서만 일어난다.
  const disabled = pending || reconnectAttempt > 0 || connectionLost;
  const ownPick = self.seat === 1 ? game.pickOne : game.pickTwo;
  const otherPick = self.seat === 1 ? game.pickTwo : game.pickOne;
  const usedUndo = self.seat === 1 ? game.undoOne : game.undoTwo;
  const requestedRematch = self.seat === 1 ? game.rematchOne : game.rematchTwo;
  const winner = room.participants.find(player => player.seat === game.winnerSeat);
  // 퇴장 확인은 방 화면에서 처리하되 팝업을 유지해 기권 확인과 같은 창에 표시한다.
  function leaveFromGame(event?: MouseEvent<HTMLButtonElement>) {
    event?.currentTarget.closest("details")?.removeAttribute("open");
    onLeave();
  }
  const scene = (
    <section className={`${styles.gameScene}${popup.container ? ` ${styles.popupScene}` : ""}`} aria-label="오목 대국">
      {popup.container && <header className={styles.popupHeading}>
        <strong><LobbyIcon name="board" />오목</strong><span><i />대국 중</span>
      </header>}
      <aside className={styles.players} aria-label="대국 참가자">
        {[self, ...room.participants.filter(player => !player.self)].map((player, index) => <div key={player.seat} className={styles.playerSlot}>
          {index === 1 && <div className={styles.versus} aria-hidden="true"><span />VS<span /></div>}
          <article className={styles.player} data-active={game.phase === "PLAYING" && game.turnSeat === player.seat}>
            <span className={styles.playerBadge}>{game.phase === "PLAYING" && game.turnSeat === player.seat ? player.self ? "내 차례" : "상대 차례" : player.self ? "나" : "상대"}</span>
            <div className={styles.playerIdentity}>
              <div className={styles.avatarWrap}><ProfileAvatar avatarId={player.avatarId} size={100} />
                <span className={styles.onlineDot} data-online={player.seat === 1 ? game.connectedOne : game.connectedTwo} />
              </div>
              <div><strong>{player.nickname}</strong><span className={styles.playerColor}>
                {game.blackSeat === 0 ? "흑백 추첨 중" : <><i className={styles.colorStone} data-color={game.blackSeat === player.seat ? "black" : "white"} />{game.blackSeat === player.seat ? "흑돌" : "백돌"} ({player.self ? "나" : "상대"})</>}
              </span></div>
            </div>
            {!popup.container && <PlayerTurnTimer nickname={player.nickname} playing={game.phase === "PLAYING"} active={game.phase === "PLAYING" && game.turnSeat === player.seat}
              serverTime={room.serverTime} deadline={game.deadline} />}
            {!(player.seat === 1 ? game.connectedOne : game.connectedTwo) && <small className={styles.disconnectedPlayer}>재접속 대기 중</small>}
          </article>
        </div>)}
      </aside>
      <div className={styles.playArea}>
      {/* 대국 중에는 방 제목·코드·규칙 문구를 반복하지 않고 참가자 정보와 판에 집중한다. */}
      {popup.container && game.phase === "PLAYING" && <PopupTurn ownTurn={game.turnSeat === self.seat} serverTime={room.serverTime} deadline={game.deadline} />}
      {(reconnectAttempt > 0 || connectionLost) && <div className={styles.connectionNotice} role="alert">
        <strong>{connectionLost ? "5회 재접속을 마쳤지만 연결하지 못했어요." : `대국 연결을 복구하고 있어요. 재접속 ${reconnectAttempt}/5`}</strong>
        <p>연결 복구 중에도 턴 시간은 계속 흘러요.{connectionLost && " 서버에서 연결 종료 결과를 확인해 주세요."}</p>
        {connectionLost && <button type="button" className={styles.secondaryButton} disabled={pending} onClick={onRecover}>결과 확인</button>}
      </div>}
      {game.phase === "DRAWING" || game.phase === "REVEAL" ? <div className={styles.lottery}>
        <span className={styles.eyebrow}>첫 수의 주인공은?</span>
        <h2>{game.phase === "DRAWING" ? "제비뽑기로 흑백을 정해요" : `${room.participants.find(player => player.seat === game.blackSeat)?.nickname}님이 흑돌이에요`}</h2>
        <p>{game.phase === "DRAWING" ? ownPick >= 0 ? "상대가 카드를 고르고 있어요." : "마음에 드는 카드 한 장을 골라주세요." : <><CountdownSeconds serverTime={room.serverTime} deadline={game.deadline} maximum={3} />초 후 대국을 시작해요.</>}</p>
        <div className={styles.cards}>
          {([0, 1] as const).map(card => {
            const chosenSeat = game.pickOne === card ? 1 : game.pickTwo === card ? 2 : 0;
            const revealedBlack = game.phase === "REVEAL" && (chosenSeat ? chosenSeat === game.blackSeat : card === 0);
            return <button key={card} type="button" className={styles.drawCard} data-revealed={game.phase === "REVEAL"}
              disabled={disabled || game.phase !== "DRAWING" || ownPick >= 0 || otherPick === card} onClick={() => onAction({ action: "PICK", card })}>
              <span className={styles.cardSymbol}>{game.phase === "DRAWING" ? "✦" : revealedBlack ? "●" : "○"}</span>
              <strong>{game.phase === "DRAWING" ? `${card + 1}번 제비` : revealedBlack ? "흑돌" : "백돌"}</strong>
              <small>{game.phase === "DRAWING" ? ownPick === card ? "내가 선택했어요" : otherPick === card ? "상대가 선택했어요" : "선택하기"
                : chosenSeat === self.seat || chosenSeat === 0 && revealedBlack === (game.blackSeat === self.seat) ? "나" : "상대"}</small>
            </button>;
          })}
        </div>
        <small>{game.phase === "DRAWING" ? <><CountdownSeconds serverTime={room.serverTime} deadline={game.deadline} maximum={20} />초 안에 선택하지 않으면 자동으로 추첨해요.</> : game.round > 1 ? "같은 상대와 재대국하면 직전 패자가 흑돌이에요." : "흑돌부터 한 수씩 번갈아 두세요."}</small>
      </div> : <>
        <div className={styles.turnBar} role="status" aria-live="polite">
          <strong>{game.phase === "FINISHED" ? game.winnerSeat === 0 ? "무승부" : winner?.self ? "승리했어요!" : `${winner?.nickname}님이 승리했어요`
            : game.turnSeat === self.seat ? "내 차례예요" : "상대의 차례예요"}</strong>
          {game.phase === "PLAYING" && <ActiveTurnCountdown serverTime={room.serverTime} deadline={game.deadline} />}
        </div>
        {/* 종료 안내는 결과 대화상자에서 확인하고 판 위에는 안내·재대국 버튼을 반복하지 않는다. */}
        {/* 무르기 요청은 판 아래의 안내 영역을 차지하지 않고 실제 오목판 위에 겹쳐 표시한다. */}
        <GameBoard key={game.id} game={game} selfSeat={self.seat} serverTime={room.serverTime} receivedAt={receivedAt}
          disabled={disabled || undoVisible} onMove={move} overlay={undoVisible ? <div className={styles.undoOverlay}>
            <section ref={undoDialogRef} className={styles.undoNotice} role="dialog" aria-labelledby={undoTitleId}
              aria-describedby={undoDescriptionId} tabIndex={-1}>
              <h2 id={undoTitleId}>{game.undoSeat === self.seat ? "무르기 응답을 기다리고 있어요" : "상대가 무르기를 요청했어요"}</h2>
              <p className={styles.undoCountdown}>응답 대기 <strong><CountdownSeconds serverTime={room.serverTime} deadline={game.undoDeadline} maximum={10} />초</strong></p>
              {game.undoSeat !== self.seat && <div className={styles.actions}>
                <button className={styles.primaryButton} type="button" disabled={disabled} onClick={() => onAction({ action: "UNDO_REPLY", accept: true })}>수락</button>
                <button className={styles.secondaryButton} type="button" disabled={disabled} onClick={() => onAction({ action: "UNDO_REPLY", accept: false })}>거절</button>
              </div>}
              <p id={undoDescriptionId} className={styles.undoDescription}>
                수락하면 요청자의 직전 착수부터 되돌려요. 응답 중에도 턴 시간은 계속 흘러요.
              </p>
            </section>
          </div> : undefined} />
        {popup.container && game.phase === "PLAYING" && <p className={styles.popupHint}>빈 교차점을 클릭하여 착수하세요</p>}
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {/* 종료 후에는 일반 화면·팝업 모두 판 아래에서 재대국 신청·대기와 나가기를 바로 선택한다. */}
      <footer className={styles.actions} data-finished={game.phase === "FINISHED"}>
        {game.phase === "FINISHED" && <button type="button" className={styles.primaryButton}
          disabled={disabled || requestedRematch} onClick={() => onAction({ action: "REMATCH" })}>
          {requestedRematch ? "상대의 재대국을 기다리고 있어요" : "한 판 더 하기"}
        </button>}
        {game.phase === "PLAYING" && <>
          <button type="button" className={styles.secondaryButton} disabled={disabled || game.undoSeat !== 0 || usedUndo >= room.undoLimit || !game.moves.some(move => move.seat === self.seat)}
            onClick={() => onAction({ action: "UNDO_REQUEST" })}><LobbyIcon name="undo" />무르기 ({room.undoLimit - usedUndo}/{room.undoLimit})</button>
          {!popup.container && <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => setResignMatchId(game.id)}><LobbyIcon name="flag" />기권하기</button>}
        </>}
        {popup.container && game.phase !== "FINISHED" ? <>
          <button type="button" className={styles.secondaryButton} onClick={popup.close}><LobbyIcon name="expand" />원래 화면</button>
          <details className={styles.popupMenu}>
            <summary aria-label="대국 메뉴"><span aria-hidden="true">•••</span></summary>
            <div>
              {game.phase === "PLAYING" && <button type="button" disabled={disabled} onClick={event => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setResignMatchId(game.id);
              }}><LobbyIcon name="flag" />기권하기</button>}
              <button type="button" disabled={pending} onClick={leaveFromGame}><LobbyIcon name="exit" />나가기</button>
            </div>
          </details>
        </> : <button type="button" className={styles.dangerButton} disabled={pending} onClick={leaveFromGame}><LobbyIcon name="exit" />나가기</button>}
      </footer>
      </div>
      {game.phase === "FINISHED" && !resultDismissed && <GameResultDialog
        result={game.winnerSeat === 0 ? "draw" : game.winnerSeat === self.seat ? "victory" : "defeat"}
        reason={game.finishReason ? reasons[game.finishReason] : ""} rematchRequested={requestedRematch} pending={disabled}
        onDismiss={() => setDismissedResultId(game.id)} onRematch={() => onAction({ action: "REMATCH" })}
        onLeave={() => { setDismissedResultId(game.id); leaveFromGame(); }} />}
      {confirmResign && <RoomDialog title="기권할까요?" busy={pending} onClose={() => setResignMatchId(undefined)}>
        <p>기권하면 이번 대국은 패배로 기록돼요.</p><div className={styles.actions}>
          <button className={styles.secondaryButton} disabled={pending} onClick={() => setResignMatchId(undefined)}>계속 두기</button>
          <button className={styles.dangerButton} disabled={disabled} onClick={() => { setResignMatchId(undefined); onAction({ action: "RESIGN" }); }}>기권하기</button>
        </div></RoomDialog>}
      {/* 원본과 팝업 중 현재 판이 있는 문서에만 퇴장 확인창을 표시한다. */}
      {leaveConfirmation}
    </section>
  );
  return <GameClockProvider serverTime={room.serverTime} receivedAt={receivedAt}><div className={styles.gameContainer}>
    {popup.container ? <section className={styles.popupPlaceholder} aria-label="팝업 대국 안내">
      <LobbyIcon name="popup" /><h2>팝업 모드로 대국 중이에요</h2>
      <p>팝업 창 상단의 최소화 버튼으로 창을 내릴 수 있어요. 이 탭은 열어 두세요.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={popup.focus}>팝업 창 보기</button>
        <button type="button" className={styles.secondaryButton} onClick={popup.close}>원래 화면으로</button>
      </div>
    </section> : popup.supported && <div className={styles.displayActions}>
      <button type="button" className={styles.secondaryButton} disabled={disabled || game.phase !== "PLAYING"}
        onClick={popup.open}><LobbyIcon name="popup" />팝업 모드</button>
    </div>}
    {popup.error && <p className={styles.error} role="alert">{popup.error}</p>}
    {/* 같은 React 대국을 이동하므로 원본과 팝업에 착수 가능한 판이 동시에 존재하지 않는다. */}
    {popup.container ? createPortal(scene, popup.container) : scene}
  </div></GameClockProvider>;
}
