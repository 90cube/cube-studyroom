// Notebook code cell. Render-only. Python syntax highlight + copy button.
// Optional per-line notes: marked lines get a tint + a hover tooltip (the note).
// Uses a custom renderer so we control line numbering + attach the note ourselves.

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import createElement from "react-syntax-highlighter/dist/esm/create-element";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useTheme } from "@/store/useTheme";

export function CodeCell({
  source,
  lines,
}: {
  source: string;
  lines?: Record<number, string>;
}) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const hasNotes = !!lines && Object.keys(lines).length > 0;

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
        renderer={
          hasNotes
            ? ({ rows, stylesheet, useInlineStyles }) =>
                rows.map((node, i) => {
                  const note = lines?.[i + 1];
                  return (
                    <span
                      key={i}
                      title={note}
                      style={{
                        display: "block",
                        ...(note
                          ? {
                              backgroundColor: "rgba(139, 92, 246, 0.16)",
                              boxShadow: "inset 2px 0 0 0 rgba(139, 92, 246, 0.9)",
                              cursor: "help",
                            }
                          : {}),
                      }}
                    >
                      {createElement({
                        node,
                        stylesheet,
                        useInlineStyles,
                        key: `line-${i}`,
                      })}
                    </span>
                  );
                })
            : undefined
        }
      >
        {source.replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}
