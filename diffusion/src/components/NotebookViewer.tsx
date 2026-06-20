// Renders one doc's cells in order, resolved through the active topic
// (diffusion = fetched notebook JSON, diffusers = authored docs). Render + local
// load state only. Explanation + diagram come from the topic too.

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { NotebookCell } from "@/models/notebook";
import { useTopic } from "@/topics/TopicContext";
import { MarkdownCell } from "@/components/cells/MarkdownCell";
import { CodeCell } from "@/components/cells/CodeCell";
import { OutputCell } from "@/components/cells/OutputCell";
import { ExplanationBlock } from "@/components/cells/ExplanationBlock";
import { DiagramBlock } from "@/components/cells/DiagramBlock";

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; cells: NotebookCell[] };

export function NotebookViewer({ id }: { id: string }) {
  const topic = useTopic();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ phase: "loading" });
    topic
      .resolveCells(id)
      .then((cells) => {
        if (alive) setState({ phase: "ready", cells });
      })
      .catch(() => {
        if (alive) setState({ phase: "error" });
      });
    return () => {
      alive = false;
    };
  }, [id, topic]);

  if (state.phase === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        불러오는 중…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        콘텐츠를 불러오지 못했어요.
      </div>
    );
  }

  if (state.cells.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        이 항목은 아직 준비 중이에요.
      </div>
    );
  }

  let codeIndex = -1;

  return (
    <div className="space-y-5">
      {state.cells.map((cell, i) => {
        if (cell.type === "markdown") {
          return <MarkdownCell key={i} source={cell.source} />;
        }
        codeIndex += 1;
        const explanation = topic.getExplanation(id, codeIndex);
        return (
          <div key={i} className="space-y-2">
            <CodeCell source={cell.source} lines={explanation?.lines} />
            {explanation && <ExplanationBlock explanation={explanation} />}
            {explanation?.diagram && <DiagramBlock diagram={explanation.diagram} />}
            {cell.outputs.length > 0 && (
              <div className="space-y-2 pl-1">
                {cell.outputs.map((out, j) => (
                  <OutputCell key={j} output={out} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
