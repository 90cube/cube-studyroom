// "강의 영상" — one outline link button per video, opens in a new tab.
// Render-only.

import { Play } from "lucide-react";
import type { Part } from "@/models/curriculum";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function YouTubeButtons({ part }: { part: Part }) {
  if (part.videos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>강의 영상</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {part.videos.map((video) => (
          <a
            key={video.url}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-start",
            )}
          >
            <Play className="text-destructive" />
            <span className="truncate">{video.title}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
