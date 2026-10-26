"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { CatalogArea } from "../catalog-grid-contracts";
import { useCatalogOrder } from "../client/use-catalog-order";
import { ConfirmDialog, Feedback, Loading } from "./admin-ui";
import { NumberedPagination } from "./numbered-pagination";
import styles from "./admin.module.css";
import grid from "./catalog-grid.module.css";

type Drag = { pointer: number; from: number; to: number; x: number; y: number; active: boolean };

/** 마우스·펜·터치의 드래그와 키보드 이동이 같은 초안·저장 동작을 사용한다. */
export function CatalogOrderEditor({ area, label, size, cancel, saved }: {
  area: CatalogArea; label: string; size: number; cancel: () => void; saved: () => void;
}) {
  const order = useCatalogOrder(area, size, saved);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [drop, setDrop] = useState<{ boundary: number; from: number }>();
  const [announcement, setAnnouncement] = useState("");
  const table = useRef<HTMLTableElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const restoreFocus = useRef(false);
  const disabled = !order.writable || order.busy || order.loading || order.conflict;
  const selectedItem = order.items?.find(item => item.code === selected);

  const move = (from: number, to: number, name: string) => {
    const item = order.items?.find(row => row.sortOrder === from);
    const shouldFocus = Boolean(table.current?.contains(document.activeElement));
    if (order.move(from, to)) {
      restoreFocus.current = shouldFocus;
      setSelected(item?.code); setAnnouncement(`${name}, ${to + 1}번째 위치로 이동했어요.`);
    }
  };
  useEffect(() => {
    // 페이지를 넘거나 행이 다시 그려져도 키보드 이동을 이어갈 수 있도록 이동한 손잡이로 복귀한다.
    if (!restoreFocus.current || !selected || !order.items) return;
    const handle = table.current?.querySelector<HTMLButtonElement>(`[data-order-code="${selected}"]`);
    if (handle) { handle.focus({ preventScroll: true }); restoreFocus.current = false; }
  }, [selected, order.items]);
  function pointerDown(event: PointerEvent<HTMLButtonElement>, position: number, code: string) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, from: position, to: position, x: event.clientX, y: event.clientY, active: false };
    setSelected(code);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.active = true;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableRowElement>("tr[data-order-position]");
    if (row && table.current?.contains(row)) {
      const rect = row.getBoundingClientRect();
      const boundary = Number(row.dataset.orderPosition) + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
      current.to = Math.max(0, Math.min(order.count - 1, boundary > current.from ? boundary - 1 : boundary));
      setDrop({ boundary, from: current.from });
    }
    // 손잡이를 잡고 화면 가장자리로 이동하면 페이지를 스크롤해 표의 다음 행을 표시한다.
    const frame = scroll.current;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      const viewportHeight = document.documentElement.clientHeight;
      if (event.clientY < 36 && rect.top < 0) window.scrollBy({ top: -18, behavior: "instant" });
      else if (event.clientY > viewportHeight - 36 && rect.bottom > viewportHeight) window.scrollBy({ top: 18, behavior: "instant" });
    }
  }
  function pointerEnd(event: PointerEvent<HTMLButtonElement>, name: string) {
    const current = drag.current;
    drag.current = undefined; setDrop(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === "pointerup" && current?.active) move(current.from, current.to, name);
  }
  return <>
    <div className={styles.panelHeading}><div><h2>{label} 순서 변경</h2><p>그리드의 행 순서가 실제 노출 순서예요.</p></div>
      <div className={grid.actions}><button type="button" disabled={order.busy} onClick={() => order.dirty ? setConfirmCancel(true) : cancel()}>취소</button>
        <button type="button" className={styles.primary} disabled={disabled || !order.dirty} onClick={() => void order.save()}>{order.busy ? "저장 중…" : "순서 저장"}</button></div>
    </div>
    <div className={grid.orderNotice}><p id={`${area}-drag-help`}>손잡이를 드래그하거나 위·아래 버튼으로 이동하세요. 변경 내용은 저장 후 반영돼요.</p>
      {order.totalPages > 1 && <div className={grid.pageMoves}><span>{selectedItem ? `${selectedItem.name} 이동` : "이동할 행의 손잡이를 선택하세요."}</span>
        <button type="button" disabled={disabled || !selectedItem || order.page === 1}
          onClick={() => selectedItem && move(selectedItem.sortOrder, (order.page - 1) * size - 1, selectedItem.name)}>이전 페이지로 이동</button>
        <button type="button" disabled={disabled || !selectedItem || order.page === order.totalPages}
          onClick={() => selectedItem && move(selectedItem.sortOrder, Math.min(order.count - 1, order.page * size), selectedItem.name)}>다음 페이지로 이동</button>
      </div>}
    </div>
    {/* 충돌 설명은 한 번만 표시하고 초안을 유지한 채 저장만 중단한다. */}
    <Feedback error={order.error && (order.conflict ? "다른 관리자가 목록의 순서를 변경했어요. 취소한 뒤 순서 변경을 다시 시작해 주세요." : order.error)} />
    <p className={styles.visuallyHidden} role="status" aria-live="polite">{announcement}</p>
    <div ref={scroll} className={grid.scroll} role="region" aria-label={`${label} 순서 변경 그리드`} tabIndex={0} aria-busy={order.loading}>
      <table ref={table} className={`${grid.table} ${grid.orderTable}`}>
        <caption className={styles.visuallyHidden}>{label} 순서 변경. 손잡이를 선택한 후 드래그하거나 이동 버튼을 사용하세요.</caption>
        <thead><tr><th scope="col">이동</th><th scope="col">순서</th><th scope="col">{label} 이름</th><th scope="col">코드</th><th scope="col">위치 변경</th></tr></thead>
        <tbody>{!order.items ? <tr><td colSpan={5}><Loading error={order.loadError} retry={order.conflict ? undefined : order.retry} /></td></tr>
          : order.items.length === 0 ? <tr><td colSpan={5}><p className={styles.empty}>등록된 {label}가 없어요.</p></td></tr>
          : order.items.map(item => <tr key={item.code} data-order-position={item.sortOrder} data-selected={selected === item.code}
            data-drop-before={drop?.boundary === item.sortOrder} data-drop-after={drop?.boundary === item.sortOrder + 1} data-dragging={drop?.from === item.sortOrder}>
            <td><button type="button" className={grid.grip} data-order-code={item.code} disabled={disabled} aria-label={`${item.name} 순서 이동`} aria-pressed={selected === item.code}
              aria-describedby={`${area}-drag-help`} onClick={() => setSelected(item.code)} onPointerDown={event => pointerDown(event, item.sortOrder, item.code)}
              onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event, item.name)} onPointerCancel={event => pointerEnd(event, item.name)}
              onKeyDown={event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                event.preventDefault(); const target = item.sortOrder + (event.key === "ArrowUp" ? -1 : 1);
                if (target >= 0 && target < order.count) move(item.sortOrder, target, item.name);
              } }}><GripIcon /></button></td>
            <td>{item.sortOrder + 1}</td><td><strong>{item.name}</strong></td><td><code>{item.code}</code></td>
            <td><div className={grid.rowMoves}><button type="button" disabled={disabled || item.sortOrder === 0} aria-label={`${item.name} 위로 이동`}
              onClick={() => { setSelected(item.code); move(item.sortOrder, item.sortOrder - 1, item.name); }}><MoveArrow /></button>
              <button type="button" disabled={disabled || item.sortOrder === order.count - 1} aria-label={`${item.name} 아래로 이동`}
                onClick={() => { setSelected(item.code); move(item.sortOrder, item.sortOrder + 1, item.name); }}><MoveArrow down /></button></div></td>
          </tr>)}</tbody>
      </table>
    </div>
    <div className={area === "game-filters" ? grid.centeredFooter : grid.footer}>{area !== "game-filters" && <p className={styles.hint}>{order.count.toLocaleString()}개 · {order.dirty ? "저장하지 않은 순서 변경이 있어요." : "전체 노출 순서"}</p>}
      <NumberedPagination page={order.page} totalPages={order.totalPages} loading={order.busy || order.loading || order.conflict}
        change={order.setPage} label={`${label} 순서 변경 페이지 탐색`} /></div>
    {confirmCancel && <ConfirmDialog title="순서 변경을 취소할까요?" close={() => setConfirmCancel(false)} confirm={cancel}><p>저장하지 않은 순서 변경을 버리고 목록으로 돌아가요.</p></ConfirmDialog>}
  </>;
}

function GripIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">{[5, 10, 15].flatMap(y => [7, 13].map(x => <circle key={`${x}:${y}`} cx={x} cy={y} r="1.3" />))}</svg>;
}
function MoveArrow({ down = false }: { down?: boolean }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={down ? { transform: "rotate(180deg)" } : undefined}><path d="m5 9 5-5 5 5M10 4v12" /></svg>;
}
