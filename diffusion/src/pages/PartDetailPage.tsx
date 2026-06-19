// Part detail: header + concept/controls layout + notebooks. Render-only;
// resolves the part from the route slug, reads status from useStudy().

import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { computePartStatus } from "@/domain/progressLogic";
import { useStudy } from "@/store/StudyStoreProvider";
import { useTopic } from "@/topics/TopicContext";
import { Badge } from "@/components/ui/badge";
import { ConceptCard } from "@/components/ConceptCard";
import { YouTubeButtons } from "@/components/YouTubeButtons";
import { ProgressControls } from "@/components/ProgressControls";
import { MemoEditor } from "@/components/MemoEditor";
import { NotebookTabs } from "@/components/NotebookTabs";
import { partStatusMeta } from "@/components/partStatusMeta";

export function PartDetailPage() {
  const { slug } = useParams();
  const { getPart } = useStudy();
  const topic = useTopic();
  const part = slug ? topic.partBySlug[slug] : undefined;

  if (!part) return <Navigate to={`/${topic.slug}`} replace />;

  const status = computePartStatus(part, getPart(part.id));
  const meta = partStatusMeta(status);

  return (
    <div className="space-y-8">
      <Link
        to={`/${topic.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {topic.title} 로드맵
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">Part {part.id}</Badge>
          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {part.titleKo}
        </h1>
        <p className="text-sm text-muted-foreground">{part.title}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConceptCard part={part} />
        </div>
        <div className="space-y-5">
          <YouTubeButtons part={part} />
          <ProgressControls part={part} />
          <MemoEditor part={part} />
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">{topic.sectionLabel}</h2>
        <NotebookTabs part={part} />
      </section>
    </div>
  );
}
