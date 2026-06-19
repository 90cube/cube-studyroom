// App shell: sticky header (title, dark-mode toggle, repo link, mini progress)
// + routed <Outlet/>. Render-only; reads overall progress from useStudy().

import { Link, Outlet } from "react-router-dom";
import { Library, Moon, Sun } from "lucide-react";
import { COURSE_REPO_URL } from "@/data/constants";
import { useTheme } from "@/store/useTheme";
import { useStudy } from "@/store/StudyStoreProvider";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { theme, toggle } = useTheme();
  const { overall } = useStudy();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="font-semibold tracking-tight text-foreground">
            diffusers 스터디
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Progress value={overall.percent} className="h-1.5 w-24" />
              <span className="w-9 text-right text-xs font-medium text-muted-foreground">
                {overall.percent}%
              </span>
            </div>

            <a
              href={COURSE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="diffusers GitHub 열기"
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
