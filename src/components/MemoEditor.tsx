// "내 메모" — textarea bound to the part memo, autosaved via the study store.
// Render-only; memo persistence handled by useStudy().setMemo (debounced).

import { Check } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { useStudy } from "@/store/StudyStoreProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function MemoEditor({ part }: { part: Part }) {
  const { getPart, setMemo } = useStudy();
  const memo = getPart(part.id).memo;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>내 메모</CardTitle>
        {memo.trim().length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3 text-success" /> 저장됨
          </span>
        )}
      </CardHeader>
      <CardContent>
        <Textarea
          value={memo}
          onChange={(e) => setMemo(part.id, e.target.value)}
          placeholder="이 파트에서 배운 점, 막혔던 부분, 다시 볼 것을 기록하세요…"
        />
      </CardContent>
    </Card>
  );
}
