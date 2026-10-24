"use client";

import { useState } from "react";
import { focusWithoutRing } from "@/lib/client/show-modal";
import { defaultLogFilters, isLogDate } from "../log-search";
import { PAGE_SIZES, type NumberedPage } from "../pagination-contracts";
import { displayChatDate, type AdminChatGame, type AdminChatMessage } from "../chat-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { ChatAuthor, ChatScopeBadge } from "./chat-message-display";
import { NumberedPagination } from "./numbered-pagination";
import { RefreshButton } from "./refresh-button";
import { ChatMessageDialog } from "./chat-message-dialog";
import admin from "./admin.module.css";
import styles from "./chat-history.module.css";

type Filters = { from: string; to: string; query: string; scope: string; gameCode: string; roomId: string };
const defaults = (): Filters => { const { from, to } = defaultLogFilters(); return { from, to, query: "", scope: "", gameCode: "", roomId: "" }; };

/** 번호 페이지·조건 검색·한 메시지 상세만 제공한다. 일반 채팅 연결과 별도의 읽기 화면이다. */
export function ChatHistoryPanel() {
  const { can, sessionId } = useAdminScope();
  return can("CHAT_HISTORY_READ") ? <ChatMessageList key={sessionId} /> : <p className={admin.empty}>채팅 내역 조회 권한이 없어요.</p>;
}
function ChatMessageList() {
  const { sessionId } = useAdminScope();
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [invalid, setInvalid] = useState(false);
  const [selected, setSelected] = useState<string>();
  const games = useAdminResource<readonly AdminChatGame[]>(sessionId, "chat/games");
  const params = new URLSearchParams({ from: filters.from, to: filters.to, page: String(page), size: String(size) });
  for (const key of ["query", "scope", "gameCode", "roomId"] as const) if (filters[key]) params.set(key, filters[key]);
  const list = useAdminResource<NumberedPage<AdminChatMessage>>(sessionId, `chat/messages?${params}`);
  const update = (key: keyof Filters, value: string) => {
    setDraft(state => ({ ...state, [key]: value, ...(key === "scope" && value === "GLOBAL" ? { gameCode: "", roomId: "" } : {}) })); setInvalid(false);
  };
  const open = (id: string, row: HTMLTableRowElement) => { const trigger = row.querySelector<HTMLButtonElement>("button"); if (trigger) focusWithoutRing(trigger); setSelected(id); };
  return <section className={`${admin.panel} ${styles.panel}`} aria-label="채팅 내역">
    <div className={styles.heading}><h2>메시지 목록</h2><RefreshButton onRefresh={list.reload} loading={list.loading} label="채팅 내역 새로고침" /></div>
    <form className={styles.filters} onSubmit={event => {
      event.preventDefault();
      if (!isLogDate(draft.from) || !isLogDate(draft.to) || draft.from > draft.to) { setInvalid(true); return; }
      setFilters({ ...draft, query: draft.query.trim() }); setPage(1); setSelected(undefined); list.reload();
    }}>
      <fieldset className={styles.period}><legend>기간</legend><div className={styles.dates}>
        <input type="date" aria-label="조회 시작일" required min="1000-01-01" max="9999-12-30" value={draft.from} onChange={event => update("from", event.target.value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? "chat-date-error" : undefined} />
        <span aria-hidden="true">~</span><input type="date" aria-label="조회 종료일" required min="1000-01-01" max="9999-12-30" value={draft.to} onChange={event => update("to", event.target.value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? "chat-date-error" : undefined} />
      </div></fieldset>
      <label className={styles.filter}><span>작성자</span><input type="search" aria-label="작성자 검색" placeholder="닉네임·회원 번호" maxLength={100} value={draft.query} onChange={event => update("query", event.target.value)} /></label>
      <label className={styles.filter}><span>채팅 구분</span><select aria-label="채팅 구분" value={draft.scope} onChange={event => update("scope", event.target.value)}><option value="">전체 채팅</option><option value="GLOBAL">공용 채팅</option><option value="GAME_ROOM">게임방 채팅</option></select></label>
      <label className={styles.filter}><span>게임</span><select aria-label="게임" value={draft.gameCode} disabled={draft.scope === "GLOBAL" || !games.data} onChange={event => update("gameCode", event.target.value)}><option value="">전체 게임</option>{games.data?.map(game => <option key={game.code} value={game.code}>{game.name}</option>)}</select></label>
      <label className={styles.filter}><span>방 번호</span><input type="text" inputMode="numeric" aria-label="방 번호" placeholder="방 번호 입력" pattern="[1-9][0-9]{0,15}" maxLength={16} disabled={draft.scope === "GLOBAL"} value={draft.roomId} onChange={event => update("roomId", event.target.value)} /></label>
      <button type="submit" className={admin.primary}>검색</button>
      <label className={`${styles.filter} ${styles.pageSize}`}><span className={admin.visuallyHidden}>페이지당 표시 개수</span><select aria-label="페이지당 표시 개수" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); setSelected(undefined); }}>{PAGE_SIZES.map(value => <option key={value} value={value}>{value}개씩</option>)}</select></label>
    </form>
    {invalid && <p id="chat-date-error" className={admin.error} role="alert">조회 기간의 시작일과 종료일을 확인해 주세요.</p>}
    {games.error && <Loading error={games.error} retry={games.reload} />}
    <div className={styles.tableScroll} role="region" aria-label="채팅 메시지 그리드" tabIndex={0} aria-busy={list.loading}>
      <table className={styles.table}><caption className={admin.visuallyHidden}>저장된 메시지 목록. 전송 시각을 선택하면 메시지 상세를 볼 수 있습니다.</caption>
        <thead><tr>{["전송 시각", "작성자", "채팅 구분", "게임", "방 번호", "메시지"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{!list.data ? <tr><td colSpan={6}><Loading error={list.error} retry={list.reload} /></td></tr> : list.data.items.length === 0 ? <tr><td colSpan={6}><p className={admin.empty}>조회된 메시지가 없어요.</p></td></tr>
          : list.data.items.map(message => <tr key={message.id} onClick={event => open(message.id, event.currentTarget)}>
            <td><button type="button" className={styles.recordButton} aria-label={`${message.authorNickname} 메시지 상세 보기`}><time dateTime={message.sentAt}>{displayChatDate(message.sentAt)}</time></button></td>
            <td><ChatAuthor message={message} /></td><td><ChatScopeBadge scope={message.scope} /></td><td>{message.gameName || "—"}</td><td>{message.roomId === null ? "—" : `#${message.roomId}`}</td><td><span className={styles.preview}>{message.content}</span></td>
          </tr>)}</tbody>
      </table>
    </div>
    <div className={styles.footer}><p className={admin.hint}>행을 선택하면 메시지 상세 정보를 볼 수 있어요.</p><NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page} loading={list.loading || !list.data} change={setPage} label="채팅 메시지 페이지 탐색" /></div>
    {selected && <ChatMessageDialog key={selected} id={selected} close={() => setSelected(undefined)} />}
  </section>;
}

