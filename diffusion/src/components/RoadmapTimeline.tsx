// Vertical roadmap of all curriculum parts: left rail with connector + numbered
// node per part, PartCard to the right. Render-only; node state from progress.

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { computePartStatus } from "@/domain/progressLogic";
import type { PartStatus } from "@/models/progress";
import { useStudy } from "@/store/StudyStoreProvider";
import { useTopic } from "@/topics/TopicContext";
import { PartCard } from "@/components/PartCard";
import { cn } from "@/lib/utils";

function nodeClasses(status: PartStatus): string {
  if (status === "done") return "bg-success/15 text-success border-success/30";
  if (status === "in_progress")
    return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

export function RoadmapTimeline() {
  const { getPart } = useStudy();
  const { curriculum } = useTopic();

  return (
    <ol className="relative space-y-4">
      {curriculum.map((part, i) => {
        const status = computePartStatus(part, getPart(part.id));
        const last = i === curriculum.length - 1;
        return (
          <motion.li
            key={part.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
            className="relative flex gap-4"
          >
            <div className="relative flex shrink-0 flex-col items-center">
              <span
                className={cn(
                  "z-10 flex size-9 items-center justify-center rounded-full border text-sm font-semibold",
                  nodeClasses(status),
                )}
              >
                {status === "done" ? (
                  <Check className="size-4" />
                ) : (
                  part.id
                )}
              </span>
              {!last && (
                <span className="absolute top-9 h-full w-px bg-border" />
              )}
            </div>
            <div className="flex-1 pb-1">
              <PartCard part={part} />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
