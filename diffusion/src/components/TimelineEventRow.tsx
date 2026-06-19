// Renders one timeline event (icon + Korean description + time). Render-only;
// resolves part title + notebook label from the curriculum data.

import { BookCheck, CircleDot, FileCheck, PencilLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/models/progress";
import { CURRICULUM } from "@/data/curriculum";

const ICONS: Record<TimelineEventType, LucideIcon> = {
  part_started: CircleDot,
  part_completed: BookCheck,
  notebook_completed: FileCheck,
  memo_updated: PencilLine,
};

function partTitle(partId: number): string {
  return CURRICULUM.find((p) => p.id === partId)?.titleKo ?? `파트 ${partId}`;
}

function notebookLabel(partId: number, notebookId?: string): string {
  if (!notebookId) return "";
  const part = CURRICULUM.find((p) => p.id === partId);
  return part?.notebooks.find((n) => n.id === notebookId)?.label ?? notebookId;
}

function describe(event: TimelineEvent): string {
  const title = partTitle(event.partId);
  switch (event.type) {
    case "part_started":
      return `${title} 학습을 시작했어요`;
    case "part_completed":
      return `${title} 파트를 완료했어요`;
    case "notebook_completed":
      return `${title} · ${notebookLabel(event.partId, event.notebookId)} 노트북 완료`;
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
  const Icon = ICONS[event.type];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{describe(event)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(event.at)}</p>
      </div>
    </li>
  );
}
