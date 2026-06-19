// "이 파트에서 배우는 것" — Korean summary (markdown) + concept tags.
// Render-only.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Part } from "@/models/curriculum";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SUMMARY_PROSE =
  "text-sm leading-relaxed text-muted-foreground " +
  "[&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-foreground " +
  "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:text-foreground";

export function ConceptCard({ part }: { part: Part }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>이 파트에서 배우는 것</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={SUMMARY_PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {part.summary}
          </ReactMarkdown>
        </div>
        {part.concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {part.concepts.map((concept) => (
              <Badge key={concept} variant="muted">
                {concept}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
