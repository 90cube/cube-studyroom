// Notebook code cell. Render-only. Python syntax highlight + copy button.

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useTheme } from "@/store/useTheme";

export function CodeCell({ source }: { source: string }) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={copy}
        aria-label="코드 복사"
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-success" /> 복사됨
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> 복사
          </>
        )}
      </button>
      <SyntaxHighlighter
        language="python"
        style={theme === "dark" ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "13px",
          background: "transparent",
        }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
      >
        {source.replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}
