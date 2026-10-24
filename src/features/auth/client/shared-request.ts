type InFlight<T> = {
  controller: AbortController;
  promise: Promise<T>;
  consumers: number;
  settled: boolean;
};

/** 진행 중인 작업만 공유한다. 한 화면의 취소는 그 화면만 종료하고 모든 대기자가 떠났을 때 실제 요청을 취소한다. */
export function createSharedRequest<T>(operation: (signal: AbortSignal) => Promise<T>): (signal?: AbortSignal) => Promise<T> {
  let current: InFlight<T> | undefined;
  return (signal?: AbortSignal) => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    let flight = current;
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const started: InFlight<T> = {
        controller, consumers: 0, settled: false,
        promise: Promise.resolve().then(() => { controller.signal.throwIfAborted(); return operation(controller.signal); }),
      };
      started.promise = started.promise.finally(() => {
        started.settled = true;
        // 취소된 이전 작업의 정리가 이미 시작된 새 작업을 지우지 않게 한다.
        if (current === started) current = undefined;
      });
      current = flight = started;
    }
    const joined = flight;
    joined.consumers++;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const leave = () => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener("abort", abort);
        if (--joined.consumers === 0 && !joined.settled) joined.controller.abort();
      };
      const abort = () => { leave(); reject(signal?.reason); };
      signal?.addEventListener("abort", abort, { once: true });
      // 취소된 소비자도 공유 Promise의 실패를 관찰해 처리되지 않은 거절을 남기지 않는다.
      joined.promise.then(value => { leave(); resolve(value); }, error => { leave(); reject(error); });
    });
  };
}
