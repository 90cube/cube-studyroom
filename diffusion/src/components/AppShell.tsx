// Topic shell: sticky header (studyroom home + topic, dark toggle, repo link,
// mini progress) + routed <Outlet/>. Reads progress from useStudy(), labels from useTopic().

import { Link, Outlet } from "react-router-dom";
import { Library, Moon, Sun, Brain } from "lucide-react";
import { useTheme } from "@/store/useTheme";
import { useStudy } from "@/store/StudyStoreProvider";
import { useTopic } from "@/topics/TopicContext";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { theme, toggle } = useTheme();
  const { overall } = useStudy();
  const topic = useTopic();
  const hasReview = topic.curriculum.some((p) => (p.recall?.length ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link to="/" className="shrink-0 font-semibold tracking-tight text-foreground">
              스터디룸
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <Link
              to={`/${topic.slug}`}
              className="truncate text-muted-foreground hover:text-foreground"
            >
              {topic.title}
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Progress value={overall.percent} className="h-1.5 w-24" />
              <span className="w-9 text-right text-xs font-medium text-muted-foreground">
                {overall.percent}%
              </span>
            </div>

            {hasReview && (
              <Link
                to={`/${topic.slug}/review`}
                aria-label="복습"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
              >
                <Brain className="size-4" />
                <span className="hidden sm:inline">복습</span>
              </Link>
            )}

            <a
              href={topic.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={topic.repoLabel}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Library />
            </a>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
