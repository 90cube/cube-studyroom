// Notebook output cell. Render-only. Dispatches by output.kind.

import type { NotebookOutput } from "@/models/notebook";

export function OutputCell({ output }: { output: NotebookOutput }) {
  switch (output.kind) {
    case "image":
      return (
        <img
          src={output.src}
          loading="lazy"
          alt="노트북 출력 이미지"
          className="max-w-full rounded-md border border-border"
        />
      );

    case "stream":
    case "text":
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-foreground">
          {output.text}
        </pre>
      );

    case "error":
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
          {`${output.ename}: ${output.evalue}`}
          {output.traceback ? `\n\n${output.traceback}` : ""}
        </pre>
      );

    case "html":
      return (
        <div
          className="overflow-x-auto rounded-md border border-border p-2 text-sm"
          // Local, trusted notebook content emitted by the preprocessor.
          dangerouslySetInnerHTML={{ __html: output.html }}
        />
      );

    default:
      return null;
  }
}
