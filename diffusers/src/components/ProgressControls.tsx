// "진도" — per-notebook done toggles + part percent + reset. Render-only;
// all state changes go through the shared study store (useStudy()).

import { Check, RotateCcw } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { computePartPercent } from "@/domain/progressLogic";
import { useStudy } from "@/store/StudyStoreProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ProgressControls({ part }: { part: Part }) {
  const { getPart, toggleNotebookDone, resetPart } = useStudy();
  const pp = getPart(part.id);
  const percent = computePartPercent(part, pp);

  const onReset = () => {
    if (window.confirm("이 파트의 진도와 완료 기록을 모두 초기화할까요?")) {
      resetPart(part.id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>진도</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">
          {percent}%
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={percent} />
        <ul className="space-y-1.5">
          {part.notebooks.map((nb) => {
            const done = pp.notebooks[nb.id]?.status === "done";
            return (
              <li key={nb.id}>
                <button
                  type="button"
                  onClick={() => toggleNotebookDone(part.id, nb.id)}
                  aria-pressed={done}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    done
                      ? "border-success/30 bg-success/10 text-foreground"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border",
                      done
                        ? "border-success bg-success text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {done && <Check className="size-3.5" />}
                  </span>
                  <span className="flex-1 truncate">{nb.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {done ? "완료" : "미완료"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground"
        >
          <RotateCcw />
          파트 초기화
        </Button>
      </CardContent>
    </Card>
  );
}
