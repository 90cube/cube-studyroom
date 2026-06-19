// "참고 소스 · 문서" — one outline link button per reference, opens in a new tab.
// Render-only. (Reuses the Part.videos field as reference links.)

import { FileText } from "lucide-react";
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
        <CardTitle>참고 소스 · 문서</CardTitle>
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
            <FileText className="text-primary" />
            <span className="truncate">{video.title}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
