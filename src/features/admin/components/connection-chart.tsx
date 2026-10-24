"use client";

import { useEffect, useId, useRef, useState } from "react";
import { chartLabel, metricNumber, type ConnectionPeak } from "../monitoring-contracts";
import styles from "./monitoring.module.css";

/** 최대 30개 지점을 SVG로 표시한다. 빈 구간의 선·면을 끊고 키보드에서도 각 관측값을 읽을 수 있다. */
export function ConnectionChart({ points, hourly }: { points: readonly ConnectionPeak[]; hourly: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const id = useId();
  useEffect(() => {
    const element = ref.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const value = entries[0]?.contentRect.width; if (value) setWidth(Math.max(220, Math.round(value))); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const left = 46, right = width - 18, top = 26, bottom = 286;
  const maximum = Math.max(1, ...points.map(point => point.peak ?? 0));
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = Math.max(1, [1, 2, 5, 10].find(value => value * magnitude >= maximum / 4)! * magnitude);
  const ceiling = step * 4;
  const x = (index: number) => left + (right - left) * index / Math.max(1, points.length - 1);
  const y = (value: number) => bottom - (bottom - top) * value / ceiling;
  const ticks = Array.from({ length: 5 }, (_, index) => step * index);
  // 일정한 간격의 눈금으로 좁은 화면의 날짜 겹침과 불규칙한 시간 간격을 피한다.
  const labelLimit = width < 480 ? 4 : hourly ? 6 : 8;
  const stride = Math.max(1, Math.ceil((points.length - 1) / (labelLimit - 1)));
  const labels = new Set(points.flatMap((_, index) => index % stride === 0 || index === points.length - 1 ? [index] : []));
  const segments: { value: number; index: number }[][] = [];
  for (const [index, point] of points.entries()) {
    if (point.peak === null) { if (segments.at(-1)?.length) segments.push([]); }
    else { if (!segments.length) segments.push([]); segments.at(-1)!.push({ index, value: point.peak }); }
  }
  const hasValues = points.some(point => point.peak !== null);
  return <div ref={ref} className={styles.chartCanvas}>
    <svg viewBox={`0 0 ${width} 340`} width="100%" height="340" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>접속 현황</title><desc id={`${id}-desc`}>{hourly ? "시간별" : "일별"} 최대 동시 접속 회원 수. 수집되지 않은 구간은 선으로 연결하지 않습니다.</desc>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9c5cff" stopOpacity=".24" /><stop offset="100%" stopColor="#9c5cff" stopOpacity=".025" /></linearGradient></defs>
      <text x="9" y="14" className={styles.axisText}>명</text>
      {ticks.map(value => <g key={value}><line x1={left} y1={y(value)} x2={right} y2={y(value)} className={styles.gridLine} /><text x={left - 12} y={y(value) + 4} textAnchor="end" className={styles.axisText}>{metricNumber(Math.round(value))}</text></g>)}
      {points.map((point, index) => labels.has(index) && <g key={point.at}><line x1={x(index)} y1={top} x2={x(index)} y2={bottom} className={styles.gridLine} /><text x={x(index)} y={bottom + 28} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className={styles.axisText}>{chartLabel(point.at, hourly)}</text></g>)}
      {segments.filter(segment => segment.length > 0).map(segment => {
        const line = segment.map(point => `${x(point.index)},${y(point.value)}`).join(" ");
        return <g key={segment[0].index}>{segment.length > 1 && <><polygon points={`${x(segment[0].index)},${bottom} ${line} ${x(segment.at(-1)!.index)},${bottom}`} fill={`url(#${id}-fill)`} /><polyline points={line} fill="none" stroke="#8b36f5" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></>}
          {segment.map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="4" className={styles.chartPoint} tabIndex={0}
            aria-label={`${chartLabel(points[point.index].at, hourly)} 최대 ${metricNumber(point.value)}명`}><title>{chartLabel(points[point.index].at, hourly)} · 최대 {metricNumber(point.value)}명</title></circle>)}
        </g>;
      })}
    </svg>
    {!hasValues && <p className={styles.noChart}>수집된 접속 기록이 없어요.</p>}
    <p className={styles.chartLegend}><span aria-hidden="true" />접속 사용자</p>
  </div>;
}
