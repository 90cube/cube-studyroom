// Topic dashboard: header + stat grid + learning roadmap + recent timeline.
// Render-only; reads overall/timeline from useStudy() and labels from useTopic().

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarDays, ChartColumn, CircleCheck, Flame } from "lucide-react";
import { distinctStudyDays, currentStreak, sortEventsDesc } from "@/domain/timelineLogic";
import { useStudy } from "@/store/StudyStoreProvider";
import { useTopic } from "@/topics/TopicContext";
import { StatCard } from "@/components/StatCard";
import { TopicOverview } from "@/components/TopicOverview";
import { RoadmapTimeline } from "@/components/RoadmapTimeline";
import { TimelineEventRow } from "@/components/TimelineEventRow";

export function DashboardPage() {
  const { overall, timeline } = useStudy();
  const topic = useTopic();
  const recent = sortEventsDesc(timeline).slice(0, 6);

  const stats = [
    { label: "전체 진도", value: `${overall.percent}%`, icon: ChartColumn, sub: `${topic.itemLabel} ${overall.completedNotebooks}/${overall.totalNotebooks}` },
    { label: "완료 파트", value: `${overall.completedParts}/${overall.totalParts}`, icon: CircleCheck },
    { label: "학습 일수", value: distinctStudyDays(timeline), icon: CalendarDays, sub: "활동한 날" },
    { label: "연속 학습", value: `${currentStreak(timeline)}일`, icon: Flame },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {topic.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{topic.blurb}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05, ease: "easeOut" }}
          >
            <StatCard label={s.label} value={s.value} icon={s.icon} sub={s.sub} />
          </motion.div>
        ))}
      </section>

      <TopicOverview />

      <section>
        <h2 className="mb-4 text-lg font-medium text-foreground">학습 로드맵</h2>
        <RoadmapTimeline />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">최근 타임라인</h2>
          {timeline.length > 0 && (
            <Link
              to={`/${topic.slug}/timeline`}
              className="text-sm font-medium text-primary hover:underline"
            >
              전체 보기
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            아직 학습 기록이 없어요. 첫 파트부터 시작해 보세요.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
            {recent.map((event) => (
              <TimelineEventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
