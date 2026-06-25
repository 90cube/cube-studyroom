// Top-down "한눈에" panel for a part: hook + one-line core + big-picture diagram
// + knowledge chain (선수 지식 → 다음으로). Shown before any detail. Render-only.

import { Link } from "react-router-dom";
import { Eye, BookOpen } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { useTopic } from "@/topics/TopicContext";
import { MermaidDiagram } from "@/components/cells/MermaidDiagram";
import { Card } from "@/components/ui/card";

export function PartOverview({ part }: { part: Part }) {
  const topic = useTopic();
  const ov = part.overview;
  if (!ov) return null;

  const prereqs = ov.prereqs
    .map((id) => topic.curriculum.find((p) => p.id === id))
    .filter((p): p is Part => Boolean(p));

  return (
    <Card className="space-y-4 border-primary/25 p-5 sm:p-6">
      <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Eye className="size-4" />
        한눈에
      </div>

      <p className="text-base font-medium leading-relaxed text-foreground">{ov.hook}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{ov.oneLine}</p>

      <MermaidDiagram code={ov.bigPicture} />

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">선수 지식</p>
          {prereqs.length === 0 ? (
            <p className="text-sm text-foreground">없음 — 여기서 시작해요</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {prereqs.map((p) => (
                <Link
                  key={p.id}
                  to={`/${topic.slug}/part/${p.slug}`}
                  className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent"
                >
                  ← {p.titleKo}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">다음으로 이어짐</p>
          <p className="text-sm leading-relaxed text-foreground">{ov.unlocks}</p>
        </div>
      </div>

      {part.primarySource && (
        <a
          href={part.primarySource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3 transition-colors hover:border-primary/40"
        >
          <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="text-sm">
            <span className="font-medium text-foreground">꼭 볼 것 — {part.primarySource.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{part.primarySource.why}</span>
          </span>
        </a>
      )}
    </Card>
  );
}
