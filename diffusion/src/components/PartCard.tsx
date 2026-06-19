// Roadmap item: links to /part/:slug. Title ko/en, notebook + video meta,
// status pill, progress bar. Render-only; reads progress from useStudy().

import { Link } from "react-router-dom";
import { FileText, Play } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { computePartPercent, computePartStatus } from "@/domain/progressLogic";
import { useStudy } from "@/store/StudyStoreProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { partStatusMeta } from "@/components/partStatusMeta";
import { cn } from "@/lib/utils";

export function PartCard({ part }: { part: Part }) {
  const { getPart } = useStudy();
  const pp = getPart(part.id);
  const status = computePartStatus(part, pp);
  const percent = computePartPercent(part, pp);
  const meta = partStatusMeta(status);

  return (
    <Link to={`/part/${part.slug}`} className="block">
      <Card
        className={cn(
          "p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
          status === "in_progress" && "ring-1 ring-primary/40",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-medium leading-tight text-foreground">
              {part.titleKo}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{part.title}</p>
          </div>
          <Badge variant={meta.badgeVariant} className="shrink-0">
            {meta.label}
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            노트북 {part.notebooks.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Play className="size-3.5" />
            영상 {part.videos.length}
          </span>
        </div>

        {percent > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Progress value={percent} className="h-1.5" />
            <span className="w-9 shrink-0 text-right text-xs font-medium text-muted-foreground">
              {percent}%
            </span>
          </div>
        )}
      </Card>
    </Link>
  );
}
