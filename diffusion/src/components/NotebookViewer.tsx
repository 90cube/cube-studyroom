// Loads one slim notebook by id and renders its cells in order. Render + local
// load state only (no domain state). Cell rendering delegated to cell components.

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { loadNotebook } from "@/system/notebookLoader";
import type { Notebook } from "@/models/notebook";
import { MarkdownCell } from "@/components/cells/MarkdownCell";
import { CodeCell } from "@/components/cells/CodeCell";
import { OutputCell } from "@/components/cells/OutputCell";
import { ExplanationBlock } from "@/components/cells/ExplanationBlock";
import { getExplanation } from "@/data/explanations";

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; notebook: Notebook };

export function NotebookViewer({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ phase: "loading" });
    loadNotebook(id)
      .then((notebook) => {
        if (alive) setState({ phase: "ready", notebook });
      })
      .catch(() => {
        if (alive) setState({ phase: "error" });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.phase === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        노트북 불러오는 중…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          노트북을 불러오지 못했어요
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1 py-0.5">npm run notebooks</code>{" "}
          를 한 번 실행했는지 확인하세요.
        </p>
      </div>
    );
  }

  const { notebook } = state;
  let codeIndex = -1;

  return (
    <div className="space-y-5">
      {notebook.cells.map((cell, i) => {
        if (cell.type === "markdown") {
          return <MarkdownCell key={i} source={cell.source} />;
        }
        codeIndex += 1;
        const explanation = getExplanation(notebook.id, codeIndex);
        return (
          <div key={i} className="space-y-2">
            <CodeCell source={cell.source} />
            {explanation && <ExplanationBlock explanation={explanation} />}
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
