import type { OverviewDay } from "@/lib/group-overview";
import {
  compareGoal,
  formatDuration,
  formatDurationCompact,
} from "@/lib/record-goal";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

// 칸 하나가 60, 위아래 여백을 뺀 그림 높이가 80입니다. 내 리듬과 같은 자리·같은 크기입니다.
const left = 46;
const top = 12;
const step = 60;
const plotHeight = 80;
const right = left + step * 6;
const barWidth = 22;
const baseline = top + plotHeight;

/**
 * 내 착석 시간. 이번 주 착석부터 퇴근까지를 하루 한 막대로 그립니다.
 * 표는 하루하루를 읽게 하지만 흐름은 보이지 않아, 착석 스터디에서 가장 궁금한
 * ‘요즘 오래 앉아 있는가’를 그림으로 둡니다. 목표에 못 미친 날만 색이 갈리고,
 * 아직 퇴근 전인 날은 값이 정해지지 않아 테두리만 그립니다.
 */
export function SeatChart({
  dates,
  days,
  goalMinutes,
}: {
  dates: string[];
  days: OverviewDay[];
  goalMinutes: number | null;
}) {
  const marks = dates.map((date, index) => {
    const day = days.find((entry) => entry.date === date);
    return {
      index,
      minutes: day?.recordMinutes ?? null,
      startMinutes: day?.startMinutes ?? null,
    };
  });
  const done = marks.filter(
    (mark): mark is { index: number; minutes: number; startMinutes: number | null } =>
      mark.minutes !== null,
  );
  const open = marks.filter(
    (mark) => mark.minutes === null && mark.startMinutes !== null,
  );
  if (done.length === 0 && open.length === 0) return null;

  const values = done.map((mark) => mark.minutes);
  // 눈금을 시간 단위로 올려 세로축 글자가 ‘5시간’처럼 떨어지게 합니다.
  const scale =
    Math.ceil((Math.max(...values, goalMinutes ?? 0, 60) * 1.1) / 60) * 60;

  const x = (index: number) => left + index * step;
  const y = (minutes: number) => baseline - (minutes / scale) * plotHeight;

  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length ? Math.round(total / values.length) : 0;
  const inGoal =
    goalMinutes === null
      ? null
      : values.filter(
          (value) => !compareGoal("DURATION", value, goalMinutes)?.missed,
        ).length;

  return (
    <section
      aria-label="내 착석 시간"
      className="mb-7 rounded-surface border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <h3>내 착석 시간</h3>
      <svg
        aria-hidden="true"
        viewBox="0 0 420 118"
        className="mt-2 h-[118px] w-full max-w-[420px]"
      >
        <text
          x={left - 8}
          y={top + 4}
          textAnchor="end"
          fontSize="9"
          fill="var(--sub)"
        >
          {formatDurationCompact(scale)}
        </text>
        <text
          x={left - 8}
          y={baseline + 3}
          textAnchor="end"
          className="tabular-nums"
          fontSize="9"
          fill="var(--sub)"
        >
          0
        </text>
        <line
          x1={left - 2}
          y1={baseline}
          x2={right + 2}
          y2={baseline}
          stroke="var(--line)"
          strokeWidth="1"
        />

        {goalMinutes !== null && goalMinutes <= scale && (
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

        {done.map((mark) => {
          const missed = compareGoal(
            "DURATION",
            mark.minutes,
            goalMinutes,
          )?.missed;
          // 아주 짧은 기록도 막대가 보이게 최소 높이를 둡니다.
          const height = Math.max(2, baseline - y(mark.minutes));
          return (
            <rect
              key={mark.index}
              x={x(mark.index) - barWidth / 2}
              y={baseline - height}
              width={barWidth}
              height={height}
              rx="2"
              fill={missed ? "var(--warn)" : "var(--brand)"}
            />
          );
        })}
        {/* 퇴근 전이라 값이 아직 없습니다. 점선 테두리로 자리만 열어 둡니다. */}
        {open.map((mark) => (
          <rect
            key={mark.index}
            x={x(mark.index) - barWidth / 2}
            y={top}
            width={barWidth}
            height={plotHeight}
            rx="2"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}

        {weekdays.map((weekday, index) => (
          <text
            key={weekday}
            x={x(index)}
            y={baseline + 20}
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
        {values.length > 0 && (
          <span className="tabular-nums">
            이번 주 {formatDuration(total)} · 하루 평균{" "}
            {formatDuration(average)}
          </span>
        )}
        {inGoal !== null && values.length > 0 && (
          <span className="tabular-nums">
            {" "}
            · 목표 안 {inGoal}/{values.length}일
          </span>
        )}
        {open.length > 0 && (
          <span className="tabular-nums">
            {values.length > 0 ? " · " : ""}
            앉아 있는 중 {open.length}일
          </span>
        )}
      </p>
    </section>
  );
}
