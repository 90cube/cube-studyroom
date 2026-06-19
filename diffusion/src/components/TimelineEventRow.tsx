// Renders one timeline event (icon + Korean description + time). Render-only;
// resolves part title + item label from the active topic's curriculum.

import { BookCheck, CircleDot, FileCheck, PencilLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Part } from "@/models/curriculum";
import type { TimelineEvent, TimelineEventType } from "@/models/progress";
import { useTopic } from "@/topics/TopicContext";

const ICONS: Record<TimelineEventType, LucideIcon> = {
  part_started: CircleDot,
  part_completed: BookCheck,
  notebook_completed: FileCheck,
  memo_updated: PencilLine,
};

function partTitle(curriculum: Part[], partId: number): string {
  return curriculum.find((p) => p.id === partId)?.titleKo ?? `파트 ${partId}`;
}

function notebookLabel(curriculum: Part[], partId: number, notebookId?: string): string {
  if (!notebookId) return "";
  const part = curriculum.find((p) => p.id === partId);
  return part?.notebooks.find((n) => n.id === notebookId)?.label ?? notebookId;
}

function describe(curriculum: Part[], itemLabel: string, event: TimelineEvent): string {
  const title = partTitle(curriculum, event.partId);
  switch (event.type) {
    case "part_started":
      return `${title} 학습을 시작했어요`;
    case "part_completed":
      return `${title} 파트를 완료했어요`;
    case "notebook_completed":
      return `${title} · ${notebookLabel(curriculum, event.partId, event.notebookId)} ${itemLabel} 완료`;
    case "memo_updated":
      return `${title} 메모를 작성했어요`;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const { curriculum, itemLabel } = useTopic();
  const Icon = ICONS[event.type];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{describe(curriculum, itemLabel, event)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(event.at)}</p>
      </div>
    </li>
  );
}
