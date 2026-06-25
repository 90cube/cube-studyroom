// Review flashcard flow — render-only. All scheduling/order lives in useReview.

import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Brain, Lightbulb, RotateCcw } from "lucide-react";
import type { ReviewCard } from "@/models/review";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewSessionProps {
  topicSlug: string;
  current: ReviewCard | null;
  revealed: boolean;
  reveal: () => void;
  grade: (remembered: boolean) => void;
  restart: () => void;
  idx: number;
  total: number;
  graded: number;
  done: boolean;
}

export function ReviewSession(p: ReviewSessionProps) {
  if (p.total === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        복습할 카드가 아직 없어요. 파트를 학습하면 회상 카드가 쌓여요.
      </Card>
    );
  }

  if (p.done) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <div className="flex justify-center">
          <Brain className="size-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-foreground">이번 세션 {p.graded}개 복습 완료 🎉</p>
        <p className="text-sm text-muted-foreground">
          알았어로 넘긴 카드는 간격을 두고 다시 나와요(간격 반복).
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Button onClick={p.restart}>
            <RotateCcw className="size-4" /> 다시 복습
          </Button>
          <Link to={`/${p.topicSlug}`} className={cn(buttonVariants({ variant: "ghost" }))}>
            대시보드로
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(p.idx / p.total) * 100}%` }}
          />
        </div>
        <span className="tabular-nums">
          {p.idx + 1} / {p.total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={p.idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <CardFace
            card={p.current!}
            revealed={p.revealed}
            reveal={p.reveal}
            grade={p.grade}
            topicSlug={p.topicSlug}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CardFace({
  card,
  revealed,
  reveal,
  grade,
  topicSlug,
}: {
  card: ReviewCard;
  revealed: boolean;
  reveal: () => void;
  grade: (remembered: boolean) => void;
  topicSlug: string;
}) {
  const [showHint, setShowHint] = useState(false);

  return (
    <Card className="space-y-5 p-6 sm:p-8">
      <Link
        to={`/${topicSlug}/part/${card.partSlug}`}
        className="inline-flex w-fit rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent"
      >
        {card.partTitleKo}
      </Link>

      <p className="text-lg font-medium leading-relaxed text-foreground">{card.q}</p>

      {!revealed ? (
        <div className="space-y-3">
          {card.hint &&
            (showHint ? (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {card.hint}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                힌트 보기
              </button>
            ))}
          <Button onClick={reveal} className="w-full sm:w-auto">
            답 확인
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
            {card.a}
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">기억해냈어?</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => grade(false)}>
                다시 볼래
              </Button>
              <Button className="flex-1" onClick={() => grade(true)}>
                알았어
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
