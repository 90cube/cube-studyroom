// Friendly, plain-language interpretation shown directly under a code cell.
// Render only — the text is supplied by the caller.

import { PencilLine } from "lucide-react";

export function ExplanationBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
        <PencilLine className="size-3.5" />
        쉽게 말하면
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}
