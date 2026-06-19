// Friendly, plain-language interpretation shown directly under a code cell.
// Render only — content supplied by the caller.

import { PencilLine, Library } from "lucide-react";
import type { CodeExplanation } from "@/data/explanations/types";

export function ExplanationBlock({ explanation }: { explanation: CodeExplanation }) {
  const { text, imports } = explanation;
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
        <PencilLine className="size-3.5" />
        쉽게 말하면
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>

      {imports && imports.length > 0 && (
        <div className="mt-3 border-t border-primary/10 pt-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary/80">
            <Library className="size-3.5" />
            이 도구들, 앞으로 이렇게 쓸 거예요
          </div>
          <ul className="space-y-1.5">
            {imports.map((imp) => (
              <li key={imp.name} className="text-xs leading-relaxed">
                <code className="rounded bg-primary/10 px-1 py-0.5 font-medium text-foreground">
                  {imp.name}
                </code>
                <span className="text-foreground/80"> — {imp.what}</span>
                <span className="block pl-1 text-muted-foreground">
                  → {imp.use}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
