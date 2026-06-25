// Review route: flattens the topic's recall items into cards and runs a session.
// Render-only; session order/scheduling lives in useReview.

import { useMemo } from "react";
import { Brain } from "lucide-react";
import { useTopic } from "@/topics/TopicContext";
import { useReview } from "@/store/useReview";
import { ReviewSession } from "@/components/ReviewSession";
import type { ReviewCard } from "@/models/review";

export function ReviewPage() {
  const topic = useTopic();

  const cards = useMemo<ReviewCard[]>(
    () =>
      topic.curriculum.flatMap((part) =>
        (part.recall ?? []).map((r, index) => ({
          partId: part.id,
          partSlug: part.slug,
          partTitleKo: part.titleKo,
          index,
          q: r.q,
          a: r.a,
          hint: r.hint,
        })),
      ),
    [topic],
  );

  const review = useReview(topic.storageNs, cards);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Brain className="size-6 text-primary" /> 복습
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          여러 파트의 핵심을 섞어 물어봐요. 기억에서 꺼내는 게 진짜 학습이에요 — 인출 연습 · 간격 반복 · 인터리빙.
        </p>
      </header>

      <ReviewSession topicSlug={topic.slug} {...review} />
    </div>
  );
}
