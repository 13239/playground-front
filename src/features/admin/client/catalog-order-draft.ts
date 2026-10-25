import type { CatalogOrderMove } from "../catalog-order-contracts";

/** 전체 행 배열을 만들지 않고 이동 구간의 위치 변환만으로 페이지의 행을 구한다. */
export type OrderOperation = Readonly<{ from: number; to: number; original: number }>;

/** 현재 위치에서 이동을 역으로 따라가 API에서 읽어야 할 원래 위치를 반환한다. */
export function originalPosition(position: number, operations: readonly OrderOperation[]): number {
  let index = position;
  for (let step = operations.length - 1; step >= 0; step--) {
    const { from, to } = operations[step];
    if (index === to) index = from;
    else if (to < from && index > to && index <= from) index--;
    else if (to > from && index >= from && index < to) index++;
  }
  return index;
}
/** 원래 행이 드래그 이후 어느 위치에 있는지 이동을 순서대로 적용해 구한다. */
export function currentPosition(original: number, operations: readonly OrderOperation[]): number {
  let index = original;
  for (const { from, to } of operations) {
    if (index === from) index = to;
    else if (to < from && index >= to && index < from) index++;
    else if (to > from && index > from && index <= to) index--;
  }
  return index;
}
export function movedPositions(operations: readonly OrderOperation[]): readonly number[] {
  return [...new Set(operations.map(operation => operation.original))];
}
export function orderChanged(operations: readonly OrderOperation[]): boolean {
  return movedPositions(operations).some(original => currentPosition(original, operations) !== original);
}

/** 같은 행을 여러 번 움직여도 최종 위치의 뒤부터 행당 한 번의 이동으로 정리한다. */
export function orderMoves(count: number, operations: readonly OrderOperation[], codeAt: (original: number) => string): readonly CatalogOrderMove[] {
  return movedPositions(operations).map(original => ({ original, position: currentPosition(original, operations) }))
    .sort((left, right) => right.position - left.position)
    .map(({ original, position }) => ({ code: codeAt(original),
      beforeCode: position + 1 === count ? null : codeAt(originalPosition(position + 1, operations)) }));
}
