// Renders one authored study doc's cells in order, with the same explanation +
// diagram treatment as the diffusion app. Render-only; content is local (no fetch).

import { getDoc } from "@/system/docLoader";
import { MarkdownCell } from "@/components/cells/MarkdownCell";
import { CodeCell } from "@/components/cells/CodeCell";
import { ExplanationBlock } from "@/components/cells/ExplanationBlock";
import { DiagramBlock } from "@/components/cells/DiagramBlock";
import { getExplanation } from "@/data/explanations";

export function StudyViewer({ id }: { id: string }) {
  const doc = getDoc(id);

  if (!doc) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        이 항목은 아직 준비 중이에요.
      </div>
    );
  }

  let codeIndex = -1;

  return (
    <div className="space-y-5">
      {doc.cells.map((cell, i) => {
        if (cell.type === "markdown") {
          return <MarkdownCell key={i} source={cell.source} />;
        }
        codeIndex += 1;
        const explanation = getExplanation(doc.id, codeIndex);
        return (
          <div key={i} className="space-y-2">
            <CodeCell source={cell.source} />
            {explanation && <ExplanationBlock explanation={explanation} />}
            {explanation?.diagram && <DiagramBlock diagram={explanation.diagram} />}
          </div>
        );
      })}
    </div>
  );
}
