// Renders a Mermaid diagram string to SVG. Mermaid is lazy-imported so it stays
// out of the main bundle. Theme-aware; falls back to showing the code on failure.

import { useEffect, useId, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTheme } from "@/store/useTheme";

export function MermaidDiagram({ code }: { code: string }) {
  const { theme } = useTheme();
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "loose",
        });
        const renderId = `mmd-${rawId}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: out } = await mermaid.render(renderId, code);
        if (!cancelled) setSvg(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme, rawId]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
        {code}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin" /> 다이어그램 그리는 중…
      </div>
    );
  }
  return (
    <div
      className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
