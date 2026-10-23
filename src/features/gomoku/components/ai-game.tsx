"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { revalidateAuthSession, useAuthSession } from "@/features/auth/client/session-store";
import { aiDifficulties, aiRules, type AiDifficulty, type AiRule } from "../ai/contracts";
import { useAiGame } from "../client/use-ai-game";
import { useGamePopup } from "../client/use-game-popup";
import { GameBoard } from "./game-board";
import { GameResultDialog } from "./game-result-dialog";
import { RoomDialog } from "./room-dialog";
import { GameEntryGate } from "@/features/games/components/game-entry-gate";
import { admitGame } from "@/features/games/client/admission";
import { AuthRequestError } from "@/features/auth/client/api";
import shared from "./gomoku.module.css";
import boardStyles from "./game-room.module.css";
import styles from "./ai-game.module.css";

/** 기존 로그인 경계를 유지하고 계정이 바뀌면 이전 계정의 로컬 대국과 워커를 함께 정리한다. */
export function AiGameScreen({ difficulty, rule }: { difficulty: AiDifficulty; rule: AiRule }) {
  const auth = useAuthSession();
  if (auth.status !== "authenticated") return <div className={shared.empty} role="status">
    <h2>로그인 상태 확인 중</h2>
    <p>{auth.status === "error" ? auth.message : "잠시만 기다려 주세요."}</p>
    {auth.status === "error" && <button type="button" className={shared.secondaryButton} onClick={revalidateAuthSession}>다시 확인</button>}
  </div>;
  return <GameEntryGate key={`${auth.session.sessionId}:${difficulty}:${rule}`} game="GOMOKU" mode="AI" sessionId={auth.session.sessionId}>
    <AiGame difficulty={difficulty} rule={rule} sessionId={auth.session.sessionId} />
  </GameEntryGate>;
}

/** 사람 대전의 판·터치 입력·결과 캐릭터를 재사용하고 AI 차례만 워커에 위임한다. */
function AiGame({ difficulty, rule, sessionId }: { difficulty: AiDifficulty; rule: AiRule; sessionId: string }) {
  const { game, thinking, move, dispatch } = useAiGame(difficulty, rule);
  // 기존 사람 대전의 창 수명·스타일·복귀 처리를 공유하며 대국 상태와 AI 워커는 원본에 한 개만 유지한다.
  const popup = useGamePopup(boardStyles.popupDocument);
  const [confirmation, setConfirmation] = useState<"leave" | "resign">();
  const [dismissedResult, setDismissedResult] = useState<number>();
  const [rematchPending, setRematchPending] = useState(false);
  const [rematchError, setRematchError] = useState<string>();
  const rematchController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => rematchController.current?.abort(), []);
  // 결과창과 판 아래의 재대국 버튼이 같은 요청을 공유하며 점검 실패 때 기존 결과·기보를 유지한다.
  async function rematch() {
    if (rematchController.current) return;
    const controller = new AbortController(); rematchController.current = controller;
    setRematchPending(true); setRematchError(undefined);
    try { await admitGame("GOMOKU", "AI", sessionId, controller.signal); if (!controller.signal.aborted) dispatch({ type: "REMATCH" }); }
    catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof AuthRequestError && error.status === 401) revalidateAuthSession();
        setRematchError(error instanceof AuthRequestError ? error.message : "새 대국을 시작하지 못했습니다.");
        setDismissedResult(game.id);
      }
    } finally { if (!controller.signal.aborted) setRematchPending(false); rematchController.current = undefined; }
  }
  const router = useRouter();
  const finished = game.phase === "FINISHED";
  const status = finished ? game.winner === 0 ? "무승부예요" : game.winner === 1 ? "승리했어요!" : "AI가 승리했어요"
    : game.error ? "AI 계산을 다시 시도해 주세요" : thinking ? "AI가 다음 수를 생각하고 있어요" : "내 차례예요";
  const leave = () => {
    if (popup.container) popup.close();
    if (finished || !game.moves.length && !thinking) {
      setDismissedResult(game.id);
      router.push("/games/gomoku");
    } else setConfirmation("leave");
  };
  // 일반 화면·팝업 모두 판 바로 위에 차례를 한 번만 표시하고 모바일에서는 참가자 정보 다음에 읽힌다.
  const turnStatus = <div className={styles.status} role="status" aria-live="polite"><strong>{status}</strong>{thinking && <span className={styles.thinking} aria-hidden="true"><i /><i /><i /></span>}</div>;

  const scene = <div className={`${styles.page}${popup.container ? ` ${boardStyles.popupScene} ${styles.popupPage}` : ""}`} data-gomoku-game={popup.container ? undefined : "ai"}>
    <header className={styles.heading}>
      <div><h1><LobbyIcon name="robot" />AI 대전</h1><span className={styles.difficulty}><LobbyIcon name={difficulty === "normal" ? "swords" : "flame"} />{aiDifficulties[difficulty].label}</span><span className={styles.ruleBadge}>{aiRules[rule].label}</span></div>
      {!popup.container && <div className={styles.displayActions}>
        {popup.supported && <button type="button" className={boardStyles.secondaryButton} onClick={popup.open}><LobbyIcon name="popup" />팝업 모드</button>}
        <button type="button" className={boardStyles.secondaryButton} onClick={leave}><LobbyIcon name="exit" />나가기</button>
      </div>}
    </header>
    <section className={styles.scene} aria-label="AI 오목 대국">
      <aside className={`${boardStyles.players} ${styles.players}`} aria-label="대국 참가자">
        {([1, 2] as const).map(seat => <article key={seat} className={boardStyles.player} data-active={!finished && game.turnSeat === seat}>
          <span className={boardStyles.playerBadge}>{finished ? seat === 1 ? "나" : "AI" : game.turnSeat === seat ? seat === 1 ? "내 차례" : game.error ? "계산 중단" : "생각 중" : "대기 중"}</span>
          <div className={boardStyles.playerIdentity}>
            <span className={styles.avatar} data-ai={seat === 2}><LobbyIcon name={seat === 1 ? "user" : "robot"} /></span>
            <div><strong>{seat === 1 ? "나" : `${aiDifficulties[difficulty].label} AI`}</strong>
              <span className={boardStyles.playerColor}><i className={boardStyles.colorStone} data-color={game.blackSeat === seat ? "black" : "white"} />{game.blackSeat === seat ? "흑돌" : "백돌"}</span>
            </div>
          </div>
        </article>)}
        <p className={styles.rules}>20×20 · {aiRules[rule].label}<br /> 시간 제한 없이 즐겨요.</p>
      </aside>
      <div className={styles.playArea}>
        {turnStatus}
        <GameBoard key={game.id} className={styles.boardSection} game={game} selfSeat={1} disabled={thinking || game.error || confirmation !== undefined} onMove={move} />
        {game.forbidden && <p className={styles.forbidden} role="alert">렌주 룰의 금수예요. 흑돌은 3·3, 4·4, 장목을 둘 수 없어요. 다른 곳을 선택해 주세요.</p>}
        {game.error && <div className={styles.failure} role="alert"><span>AI 계산을 완료하지 못했어요. 다시 시도해 주세요.</span><button type="button" className={boardStyles.secondaryButton} onClick={() => dispatch({ type: "RETRY" })}>다시 시도</button></div>}
        {/* 종료 후에도 두 동작을 판 안쪽의 짧은 버튼 행에 함께 표시한다. */}
        <footer className={`${boardStyles.actions} ${styles.actions}`} data-finished={finished}>
          {finished ? <>
            <button type="button" className={boardStyles.primaryButton} disabled={rematchPending} onClick={() => void rematch()}><LobbyIcon name="undo" />한 판 더 하기</button>
            <button type="button" className={boardStyles.secondaryButton} onClick={leave}><LobbyIcon name="exit" />나가기</button>
          </> : <>
            <button type="button" className={boardStyles.secondaryButton} disabled={game.undoUsed || !game.moves.some(item => item.seat === 1)} onClick={() => dispatch({ type: "UNDO" })}><LobbyIcon name="undo" />무르기 ({game.undoUsed ? 0 : 1}/1)</button>
            {!popup.container && <button type="button" className={boardStyles.secondaryButton} onClick={() => setConfirmation("resign")}><LobbyIcon name="flag" />기권하기</button>}
          </>}
          {popup.container && <button type="button" className={boardStyles.secondaryButton} onClick={popup.close}><LobbyIcon name="expand" />원래 화면</button>}
          {popup.container && !finished && <details className={boardStyles.popupMenu}>
            <summary aria-label="대국 메뉴"><span aria-hidden="true">•••</span></summary>
            <div>
              <button type="button" onClick={event => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setConfirmation("resign");
              }}><LobbyIcon name="flag" />기권하기</button>
              <button type="button" onClick={leave}><LobbyIcon name="exit" />나가기</button>
            </div>
          </details>}
        </footer>
      </div>
    </section>
    {rematchError && <p className={boardStyles.error} role="alert">{rematchError}</p>}
    {confirmation && <RoomDialog title={confirmation === "leave" ? "대국을 나갈까요?" : "기권할까요?"} onClose={() => setConfirmation(undefined)}>
      <p>{confirmation === "leave" ? "진행 중인 AI 대국이 종료돼요." : "이번 대국은 AI의 승리로 끝나요."}</p>
      <div className={shared.actions}>
        <button type="button" className={shared.secondaryButton} onClick={() => setConfirmation(undefined)}>계속 두기</button>
        <button type="button" className={shared.dangerButton} onClick={() => {
          if (confirmation === "leave") router.push("/games/gomoku");
          else dispatch({ type: "RESIGN" });
          setConfirmation(undefined);
        }}>{confirmation === "leave" ? "나가기" : "기권하기"}</button>
      </div>
    </RoomDialog>}
    {/* 확인 중 AI가 대국을 끝내더라도 결과창을 겹쳐 열지 않는다. */}
    {finished && !confirmation && dismissedResult !== game.id && <GameResultDialog result={game.winner === 1 ? "victory" : game.winner === 2 ? "defeat" : "draw"}
      reason={game.reason === "FIVE" ? "다섯 돌을 완성했어요." : game.reason === "RESIGN" ? "기권으로 대국이 끝났어요." : "판이 모두 채워졌어요."}
      rematchRequested={false} pending={rematchPending} onRematch={() => void rematch()} onLeave={leave} onDismiss={() => setDismissedResult(game.id)} />}
  </div>;
  return <>
    {popup.container && <section className={`${styles.page} ${boardStyles.popupPlaceholder}`} aria-label="팝업 대국 안내">
      <LobbyIcon name="popup" /><h2>팝업 모드로 대국 중이에요</h2>
      <p>팝업 창 상단의 최소화 버튼으로 창을 내릴 수 있어요. 이 탭은 열어 두세요.</p>
      <div className={boardStyles.actions}>
        <button type="button" className={boardStyles.primaryButton} onClick={popup.focus}>팝업 창 보기</button>
        <button type="button" className={boardStyles.secondaryButton} onClick={popup.close}>원래 화면으로</button>
      </div>
    </section>}
    {popup.error && <p className={boardStyles.error} role="alert">{popup.error}</p>}
    {/* 실제 입력 가능한 판은 원래 화면과 팝업 중 한 곳에만 표시한다. */}
    {popup.container ? createPortal(scene, popup.container) : scene}
  </>;
}
