"use client";
import { useCallback, useEffect, useState } from "react";
import { formatTime, type Mode } from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import { NumberedPagination } from "@/features/admin/components/numbered-pagination";
import { readRankings } from "../client/api";
import type { ShootingOverview } from "../contracts";
import styles from "./shooting.module.css";

export function Rankings({
  sessionId,
  mode,
}: {
  sessionId: string;
  mode: Mode;
}) {
  const [data, setData] = useState<ShootingOverview>();
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(
    (signal: AbortSignal) => readRankings(sessionId, mode, page, signal),
    [sessionId, mode, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setPage(value.page);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("순위를 불러오지 못했어요.");
      });
    return () => controller.abort();
  }, [load, attempt]);
  const current = data?.mode === mode && data.page === page ? data : undefined;
  return (
    <section className={styles.rankings}>
      <div>
        <h2>
          <Icon name="trophy" />
          {mode === "SINGLE" ? "1인" : "2인 협동"} TOP 100
        </h2>
        <small>완료 스테이지 ↓ · 누적 전투 시간 ↑</small>
      </div>
      {error ? (
        <p role="status">
          {error}{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>
            다시 확인
          </button>
        </p>
      ) : !current ? (
        <p role="status">기록을 불러오고 있어요.</p>
      ) : (
        <>
          <div className={styles.rankTable}>
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>플레이어</th>
                  <th>완료 스테이지</th>
                  <th>누적 전투 시간</th>
                </tr>
              </thead>
              <tbody>
                {current.rankings.length ? (
                  current.rankings.map((row) => (
                    <tr key={row.rank} data-self={row.self}>
                      <td>{row.rank.toString().padStart(2, "0")}</td>
                      <td>
                        {row.nickname}
                        {row.teammate && <small> with {row.teammate}</small>}
                      </td>
                      <td>STAGE {row.stage}</td>
                      <td>{formatTime(row.combatMillis)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>첫 번째 기록의 주인공이 되어 보세요.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* 랭킹도 공통 번호 페이지 이동으로 첫 페이지·마지막 페이지에 바로 접근한다. */}
          <NumberedPagination
            page={page}
            totalPages={current.totalPages}
            change={setPage}
            label="슈팅 랭킹 페이지"
          />
        </>
      )}
    </section>
  );
}
