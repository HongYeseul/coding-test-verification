import type { OverviewDay } from "@/lib/group-overview";
import { compareGoal, formatClock } from "@/lib/record-goal";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

// 칸 하나가 60, 위아래 여백을 뺀 그림 높이가 80입니다.
const left = 46;
const top = 12;
const step = 60;
const plotHeight = 80;
const right = left + step * 6;

/**
 * 내 리듬. 이번 주 도장을 찍은 시각을 이어 그립니다. 표는 하루하루를 읽게 하지만
 * 흐름은 보이지 않아, 기상 스터디에서 가장 궁금한 ‘요즘 당겨지고 있는가’를 그림으로 둡니다.
 * 위쪽이 이른 시각입니다. 목표보다 늦은 날은 속이 빈 점입니다.
 */
export function RecordRhythm({
  dates,
  days,
  goalMinutes,
}: {
  dates: string[];
  days: OverviewDay[];
  goalMinutes: number | null;
}) {
  const marks = dates
    .map((date, index) => ({
      index,
      minutes: days.find((day) => day.date === date)?.recordMinutes ?? null,
    }))
    .filter(
      (mark): mark is { index: number; minutes: number } =>
        mark.minutes !== null,
    );
  if (marks.length === 0) return null;

  const values = marks.map((mark) => mark.minutes);
  const bounds = goalMinutes === null ? values : [...values, goalMinutes];
  const lowest = Math.min(...bounds);
  const highest = Math.max(...bounds);
  // 값이 몰려 있어도 선이 납작해지지 않게 최소 폭을 둡니다.
  const padding = Math.max(15, (highest - lowest) * 0.2);
  const from = lowest - padding;
  const to = highest + padding;

  const x = (index: number) => left + index * step;
  const y = (minutes: number) =>
    top + ((minutes - from) / (to - from)) * plotHeight;

  const average = Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
  const inGoal =
    goalMinutes === null
      ? null
      : values.filter(
          (value) => !compareGoal("CLOCK", value, goalMinutes)?.missed,
        ).length;

  return (
    <section
      aria-label="내 리듬"
      className="mb-7 rounded-surface border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <h3>내 리듬</h3>
      <svg
        aria-hidden="true"
        viewBox="0 0 420 118"
        className="mt-2 h-[118px] w-full max-w-[420px]"
      >
        <text
          x={left - 8}
          y={top + 4}
          textAnchor="end"
          className="font-mono"
          fontSize="9"
          fill="var(--sub)"
        >
          {formatClock(from)}
        </text>
        <text
          x={left - 8}
          y={top + plotHeight + 4}
          textAnchor="end"
          className="font-mono"
          fontSize="9"
          fill="var(--sub)"
        >
          {formatClock(to)}
        </text>

        {goalMinutes !== null && (
          <>
            <line
              x1={left}
              y1={y(goalMinutes)}
              x2={right}
              y2={y(goalMinutes)}
              stroke="var(--sub)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.7"
            />
            <text
              x={right}
              y={y(goalMinutes) - 5}
              textAnchor="end"
              fontSize="9"
              fill="var(--sub)"
            >
              목표
            </text>
          </>
        )}

        <polyline
          points={marks
            .map((mark) => `${x(mark.index)},${y(mark.minutes)}`)
            .join(" ")}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {marks.map((mark) => {
          const missed = compareGoal("CLOCK", mark.minutes, goalMinutes)?.missed;
          return (
            <circle
              key={mark.index}
              cx={x(mark.index)}
              cy={y(mark.minutes)}
              r="3.5"
              fill={missed ? "var(--surface)" : "var(--brand)"}
              stroke={missed ? "var(--warn)" : "none"}
              strokeWidth="1.5"
            />
          );
        })}

        {weekdays.map((weekday, index) => (
          <text
            key={weekday}
            x={x(index)}
            y={top + plotHeight + 20}
            textAnchor="middle"
            fontSize="10"
            fill="var(--sub)"
          >
            {weekday}
          </text>
        ))}
      </svg>
      {/* 차트를 못 보는 사람도 같은 것을 읽도록 요약을 글자로 둡니다. */}
      <p className="mt-1 text-[13px] text-sub">
        이번 주 평균{" "}
        <span className="font-mono tabular-nums">{formatClock(average)}</span>
        {inGoal !== null && (
          <span className="tabular-nums">
            {" "}
            · 목표 안 {inGoal}/{values.length}일
          </span>
        )}
      </p>
    </section>
  );
}
