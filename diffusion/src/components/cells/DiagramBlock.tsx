// Algorithm/architecture diagram under a code cell. Complex diagrams show a
// summary by default with a click-to-expand detail view (depth). Local UI state only.

import { useState } from "react";
import { Network, Workflow, ChevronDown, ChevronUp } from "lucide-react";
import type { DiagramSpec } from "@/data/explanations/types";
import { MermaidDiagram } from "@/components/cells/MermaidDiagram";

export function DiagramBlock({ diagram }: { diagram: DiagramSpec }) {
  const [expanded, setExpanded] = useState(false);
  const isArch = diagram.kind === "architecture";
  const Icon = isArch ? Network : Workflow;
  const showDetail = expanded && !!diagram.detail;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {isArch ? "구조도" : "알고리즘"} · {diagram.title}
        {diagram.detail && (
          <span className="text-muted-foreground/70">
            {showDetail ? "· 상세" : "· 축약"}
          </span>
        )}
      </div>

      <MermaidDiagram code={showDetail ? diagram.detail! : diagram.summary} />

      {diagram.detail && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {showDetail ? (
            <>
              <ChevronUp className="size-3.5" /> 요약만 보기
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" /> 자세히 보기 — 전체 단계 펼치기
            </>
          )}
        </button>
      )}
    </div>
  );
}
