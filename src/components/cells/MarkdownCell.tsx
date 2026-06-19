// Notebook markdown cell. Render-only. Manual typography (no typography plugin).

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const PROSE =
  "max-w-none text-sm leading-relaxed text-foreground " +
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-5 [&_h1]:mb-3 " +
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 " +
  "[&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 " +
  "[&_p]:my-2 " +
  "[&_strong]:font-semibold [&_strong]:text-foreground " +
  "[&_em]:italic " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 " +
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 " +
  "[&_li]:my-1 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] " +
  "[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-3 " +
  "[&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_table]:border-collapse " +
  "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:text-left " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 " +
  "[&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 " +
  "[&_hr]:my-4 [&_hr]:border-border";

export function MarkdownCell({ source }: { source: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
