"use client";

import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import type { WaitingRoom } from "../waiting-contracts";
import type { GameAction, MatchState } from "../game-contracts";
import { RoomDialog } from "./room-dialog";
import { GameBoard } from "./game-board";
import { GameResultDialog } from "./game-result-dialog";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./game-room.module.css";

const reasons = { FIVE: "다섯 돌을 완성했어요.", BOARD_FULL: "판이 모두 채워져 무승부예요.", RESIGN: "기권으로 대국이 끝났어요.",
  DISCONNECT: "연결을 복구하지 못해 대국이 끝났어요.", INTERRUPTED: "양쪽 연결이 끊겨 대국을 중단했어요." } as const;

/** 같은 방 안에서 추첨·판·결과·재대국을 표시한다. 모든 변경은 서버 응답을 확인한 뒤 반영한다. */
export function GameRoom({ room, pending, error, reconnectAttempt, connectionLost, onAction, onLeave, onRecover }: {
  room: WaitingRoom & { game: MatchState }; pending: boolean; error: string; reconnectAttempt: number; connectionLost: boolean;
  onAction: (action: GameAction) => void; onLeave: () => void; onRecover: () => void;
}) {
  const game = room.game;
  const self = room.participants.find(player => player.self)!;
  const [clock, setClock] = useState({ server: room.serverTime, elapsed: 0 });
  const [confirmResign, setConfirmResign] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => setClock({ server: room.serverTime, elapsed: performance.now() - start }), 200);
    return () => clearInterval(timer);
  }, [room.serverTime]);
  // 서버와 다른 PC 시계에서도 남은 시간은 수신한 서버 시각과 단조 시계의 경과 시간으로만 표시한다.
  const now = Date.parse(room.serverTime) + (clock.server === room.serverTime ? clock.elapsed : 0);
  const remaining = game.deadline ? Math.min(game.phase === "DRAWING" ? 20 : game.phase === "REVEAL" ? 3 : 30,
    Math.max(0, Math.ceil((Date.parse(game.deadline) - now) / 1000))) : 0;
  const undoRemaining = game.undoDeadline ? Math.max(0, Math.ceil((Date.parse(game.undoDeadline) - now) / 1000)) : 0;
  const disabled = pending || reconnectAttempt > 0 || connectionLost;
  const ownPick = self.seat === 1 ? game.pickOne : game.pickTwo;
  const otherPick = self.seat === 1 ? game.pickTwo : game.pickOne;
  const usedUndo = self.seat === 1 ? game.undoOne : game.undoTwo;
  const requestedRematch = self.seat === 1 ? game.rematchOne : game.rematchTwo;
  const winner = room.participants.find(player => player.seat === game.winnerSeat);
  return (
    <section className={styles.gameScene} aria-label="오목 대국">
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
            <div className={styles.playerTimer} data-active={game.phase === "PLAYING" && game.turnSeat === player.seat}>
              <div><LobbyIcon name="clock" /><strong>00:{String(game.phase === "PLAYING" ? game.turnSeat === player.seat ? remaining : 30 : 0).padStart(2, "0")}</strong></div>
              <progress max={30} value={game.phase === "PLAYING" ? game.turnSeat === player.seat ? remaining : 30 : 0}
                aria-label={`${player.nickname}님 남은 턴 시간`} />
            </div>
            {!(player.seat === 1 ? game.connectedOne : game.connectedTwo) && <small className={styles.disconnectedPlayer}>재접속 대기 중</small>}
          </article>
        </div>)}
      </aside>
      <div className={styles.playArea}>
      <header className={styles.gameHeader}><div><span className={styles.eyebrow}>GOMOKU · {game.round}번째 대국</span>
        <h1>{room.title}</h1></div><span className={styles.roomCode}>방 코드 {room.inviteCode}</span></header>
      {(reconnectAttempt > 0 || connectionLost) && <div className={styles.connectionNotice} role="alert">
        <strong>{connectionLost ? "5회 재접속을 마쳤지만 연결하지 못했어요." : `대국 연결을 복구하고 있어요. 재접속 ${reconnectAttempt}/5`}</strong>
        <p>연결 복구 중에도 턴 시간은 계속 흘러요.{connectionLost && " 서버에서 연결 종료 결과를 확인해 주세요."}</p>
        {connectionLost && <button type="button" className={styles.secondaryButton} disabled={pending} onClick={onRecover}>결과 확인</button>}
      </div>}
      {game.phase === "DRAWING" || game.phase === "REVEAL" ? <div className={styles.lottery}>
        <span className={styles.eyebrow}>첫 수의 주인공은?</span>
        <h2>{game.phase === "DRAWING" ? "제비뽑기로 흑백을 정해요" : `${room.participants.find(player => player.seat === game.blackSeat)?.nickname}님이 흑돌이에요`}</h2>
        <p>{game.phase === "DRAWING" ? ownPick >= 0 ? "상대가 카드를 고르고 있어요." : "마음에 드는 카드 한 장을 골라주세요." : `${remaining}초 후 대국을 시작해요.`}</p>
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
        <small>{game.phase === "DRAWING" ? `${remaining}초 안에 선택하지 않으면 자동으로 추첨해요.` : game.round > 1 ? "같은 상대와 재대국하면 직전 패자가 흑돌이에요." : "흑돌부터 한 수씩 번갈아 두세요."}</small>
      </div> : <>
        <div className={styles.turnBar} role="status" aria-live="polite">
          <strong>{game.phase === "FINISHED" ? game.winnerSeat === 0 ? "무승부" : winner?.self ? "승리했어요!" : `${winner?.nickname}님이 승리했어요`
            : game.turnSeat === self.seat ? "내 차례예요" : "상대의 차례예요"}</strong>
          {game.phase === "PLAYING" && <span className={styles.timer} data-urgent={remaining <= 10} aria-live="off">{remaining}<small>초</small></span>}
        </div>
        {game.phase === "PLAYING" && <p className={styles.ruleHint}>한 수 30초 · 시간 초과 시 상대 턴으로 넘어가요 · {room.forbiddenRule === "STANDARD" ? "흑 3·3 / 4·4 / 장목 금수" : "금수 없는 자유 룰"}</p>}
        {game.phase === "FINISHED" && <div className={styles.result}>
          <p>{game.finishReason && reasons[game.finishReason]}</p>
          <div className={styles.actions}><button className={styles.primaryButton} type="button" disabled={disabled || requestedRematch} onClick={() => onAction({ action: "REMATCH" })}>
            {requestedRematch ? "상대의 재대국을 기다리고 있어요" : "한 판 더 하기"}</button>
          <button className={styles.secondaryButton} type="button" onClick={() => setResultDismissed(false)}>결과 보기</button></div>
          <small>{game.winnerSeat === 0 ? "무승부 다음 판은 다시 제비뽑기를 해요." : "다음 판은 진 사람이 흑돌이에요."}</small>
        </div>}
        <GameBoard key={game.id} game={game} selfSeat={self.seat} disabled={disabled || remaining === 0} onMove={(x, y) => onAction({ action: "MOVE", x, y })} />
        {game.phase === "PLAYING" && game.undoSeat > 0 && <div className={styles.undoNotice} role="status">
          <p>{game.undoSeat === self.seat ? "상대에게 무르기를 요청했어요." : "상대가 무르기를 요청했어요."} <small>응답 대기 {undoRemaining}초</small></p>
          {game.undoSeat !== self.seat && <div className={styles.actions}>
            <button className={styles.primaryButton} type="button" disabled={disabled || undoRemaining === 0} onClick={() => onAction({ action: "UNDO_REPLY", accept: true })}>수락</button>
            <button className={styles.secondaryButton} type="button" disabled={disabled || undoRemaining === 0} onClick={() => onAction({ action: "UNDO_REPLY", accept: false })}>거절</button>
          </div>}
          <small>수락하면 요청자의 직전 착수부터 되돌려요. 응답 중에도 턴 시간은 계속 흘러요.</small>
        </div>}
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer className={styles.actions}>
        {game.phase === "PLAYING" && <>
          <button type="button" className={styles.secondaryButton} disabled={disabled || game.undoSeat !== 0 || usedUndo >= room.undoLimit || !game.moves.some(move => move.seat === self.seat)}
            onClick={() => onAction({ action: "UNDO_REQUEST" })}><LobbyIcon name="undo" />무르기 ({room.undoLimit - usedUndo}/{room.undoLimit})</button>
          <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => setConfirmResign(true)}><LobbyIcon name="flag" />기권하기</button>
        </>}
        <button type="button" className={styles.dangerButton} disabled={pending} onClick={onLeave}><LobbyIcon name="exit" />나가기</button>
      </footer>
      </div>
      {game.phase === "FINISHED" && !resultDismissed && <GameResultDialog
        result={game.winnerSeat === 0 ? "draw" : game.winnerSeat === self.seat ? "victory" : "defeat"}
        reason={game.finishReason ? reasons[game.finishReason] : ""} rematchRequested={requestedRematch} pending={disabled}
        onDismiss={() => setResultDismissed(true)} onRematch={() => onAction({ action: "REMATCH" })}
        onLeave={() => { setResultDismissed(true); onLeave(); }} />}
      {confirmResign && <RoomDialog title="기권할까요?" busy={pending} onClose={() => setConfirmResign(false)}>
        <p>기권하면 이번 대국은 패배로 기록돼요.</p><div className={styles.actions}>
          <button className={styles.secondaryButton} disabled={pending} onClick={() => setConfirmResign(false)}>계속 두기</button>
          <button className={styles.dangerButton} disabled={disabled} onClick={() => { setConfirmResign(false); onAction({ action: "RESIGN" }); }}>기권하기</button>
        </div></RoomDialog>}
    </section>
  );
}
