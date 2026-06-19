// Studyroom landing: pick a topic. Has its own minimal header (no topic context
// here). Reads each topic's progress directly from storage for the cards.

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { TOPICS } from "@/topics/registry";
import { loadProgress } from "@/system/storage";
import { computeOverall } from "@/domain/progressLogic";
import { useTheme } from "@/store/useTheme";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="font-semibold tracking-tight text-foreground">
            Cube 스터디룸
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            공부방
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            배우는 걸 코드로 정리하는 학습 허브. 주제를 골라 들어가세요.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {TOPICS.map((topic, i) => {
            const overall = computeOverall(topic.curriculum, loadProgress(topic.storageNs));
            const Icon = topic.icon;
            return (
              <motion.div
                key={topic.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06, ease: "easeOut" }}
              >
                <Link to={`/${topic.slug}`} className="block h-full">
                  <Card className="flex h-full flex-col gap-4 p-6 transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-foreground">{topic.title}</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">{topic.titleEn}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {topic.blurb}
                    </p>
                    <div className="mt-auto space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{topic.curriculum.length}파트 · 진도 {overall.percent}%</span>
                        <span>완료 {overall.completedParts}/{overall.totalParts}</span>
                      </div>
                      <Progress value={overall.percent} className="h-1.5" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
