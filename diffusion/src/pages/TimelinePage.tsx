// Full timeline: all events newest-first, grouped by local date. Render-only.

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { localDayKey, sortEventsDesc } from "@/domain/timelineLogic";
import type { TimelineEvent } from "@/models/progress";
import { useStudy } from "@/store/StudyStoreProvider";
import { TimelineEventRow } from "@/components/TimelineEventRow";

function groupByDay(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = localDayKey(event.at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }
  return [...groups.entries()];
}

function formatDay(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function TimelinePage() {
  const { timeline } = useStudy();
  const groups = groupByDay(sortEventsDesc(timeline));

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        로드맵
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          학습 타임라인
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          모든 학습 활동을 최신순으로 모아 봅니다.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          아직 학습 기록이 없어요. 파트를 시작하면 여기에 활동이 쌓입니다.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, events]) => (
            <section key={day}>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatDay(day)}
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
                {events.map((event) => (
                  <TimelineEventRow key={event.id} event={event} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
