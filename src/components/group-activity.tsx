import type { ReactNode } from "react";

import {
  activityTime,
  type ActivityKind,
  type GroupActivityEvent,
} from "@/lib/group-activity";
import { formatClock, formatDuration } from "@/lib/record-goal";
import { Seal } from "@/components/seal";

/** 이름은 문장 안에서 굵게 둡니다. 누가 한 일인지가 먼저 읽혀야 합니다. */
function Name({ children }: { children: string }) {
  return <span className="font-medium text-ink">{children}</span>;
}

/** 줄 왼쪽의 표시. 도장판과 같은 도형을 써서 두 화면이 같은 말을 합니다. */
function Mark({ kind }: { kind: ActivityKind }) {
  if (kind === "REJECTED") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border border-line text-[11px] font-[650] text-danger"
      >
        ×
      </span>
    );
  }
  if (kind === "CHEER") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 size-5 shrink-0 text-danger"
        fill="currentColor"
      >
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
    );
  }
  // 착석은 아직 결과가 아니라 시작이라 점선 도장으로 둡니다.
  return (
    <Seal
      ghost={kind === "SEAT_START"}
      className="mt-0.5 size-5 shrink-0"
      tilt="-6deg"
    />
  );
}

/** 한 줄짜리 문장입니다. 값이 없으면 그 조각만 빠집니다. */
function sentence(event: GroupActivityEvent): ReactNode {
  const actor = <Name>{event.actorName}</Name>;
  const target = event.targetName ? <Name>{event.targetName}</Name> : null;
  switch (event.kind) {
    case "SEAT_START":
      return (
        <>
          {actor}님이{" "}
          {event.minutes !== null && (
            <span className="font-mono tabular-nums">
              {formatClock(event.minutes)}
            </span>
          )}
          에 착석했습니다
        </>
      );
    case "SEAT_END":
      return (
        <>
          {actor}님이 퇴근했습니다
          {event.minutes !== null && ` · ${formatDuration(event.minutes)}`}
        </>
      );
    case "CLOCK":
      return (
        <>
          {actor}님이{" "}
          {event.minutes !== null && (
            <span className="font-mono tabular-nums">
              {formatClock(event.minutes)}
            </span>
          )}
          에 도장을 찍었습니다
        </>
      );
    case "CHEER":
      return (
        <>
          {actor}님이 {target}님에게 응원을 보냈습니다
        </>
      );
    case "APPROVED":
      return (
        <>
          {actor}님이 {target}님의 기록을 승인했습니다
        </>
      );
    case "REJECTED":
      return (
        <>
          {actor}님이 {target}님의 기록을 반려했습니다
        </>
      );
    default:
      return <>{actor}님이 도장을 찍었습니다</>;
  }
}

/**
 * 최근 활동. 도장판은 무엇이 쌓였는지를 보여주고, 여기는 방금 무슨 일이 있었는지를
 * 보여줍니다. 서로 독려하는 서비스라 남이 움직이는 것이 보여야 합니다.
 */
export function GroupActivity({
  events,
  today,
}: {
  events: GroupActivityEvent[];
  today: string;
}) {
  return (
    <section aria-labelledby="group-activity-title">
      <h2 id="group-activity-title" className="mb-3">
        최근 활동
      </h2>
      {events.length ? (
        <ol className="rounded-surface border border-line bg-surface">
          {events.map((event) => (
            <li
              key={`${event.kind}-${event.proofId}-${event.at}`}
              className="flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-b-0"
            >
              <Mark kind={event.kind} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[1.6] text-sub">
                  {sentence(event)}
                </span>
                {/* 반려 이유는 그대로 인용합니다. 요약하면 뜻이 달라집니다. */}
                {event.note && (
                  <span className="mt-1 block border-l-2 border-line pl-2 text-[13px] leading-[1.6] text-sub">
                    {event.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[12px] text-sub tabular-nums">
                {activityTime(event.at, today)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-surface border border-line bg-surface px-4 py-8 text-center text-[13px] text-sub">
          아직 아무 일도 없어요. 첫 도장을 찍어보세요.
        </p>
      )}
    </section>
  );
}
