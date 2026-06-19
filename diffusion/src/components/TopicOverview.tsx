// Top-down "큰 그림" for a topic: the whole arc as one diagram + a short
// narrative, shown above the part roadmap. Render-only; reads from useTopic().

import { Map } from "lucide-react";
import { useTopic } from "@/topics/TopicContext";
import { MermaidDiagram } from "@/components/cells/MermaidDiagram";
import { MarkdownCell } from "@/components/cells/MarkdownCell";
import { Card } from "@/components/ui/card";

export function TopicOverview() {
  const { overview } = useTopic();
  if (!overview) return null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-primary">
        <Map className="size-4" />
        큰 그림 — 이렇게 흐른다
      </div>
      <MermaidDiagram code={overview.map} />
      <div className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        <MarkdownCell source={overview.narrative} />
      </div>
    </Card>
  );
}
