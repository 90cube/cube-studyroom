// References card (topic-labelled) — one outline link button per reference,
// opens in a new tab. Render-only. Uses the Part.videos field as links.

import { ExternalLink } from "lucide-react";
import type { Part } from "@/models/curriculum";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useTopic } from "@/topics/TopicContext";
import { cn } from "@/lib/utils";

export function YouTubeButtons({ part }: { part: Part }) {
  const topic = useTopic();
  if (part.videos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{topic.refLabel}</CardTitle>
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
            <ExternalLink className="text-primary" />
            <span className="truncate">{video.title}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
