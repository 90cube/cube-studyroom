// UI-only presentation mapping for a PartStatus. Pure (no side effects).
// Keeps Korean status labels + badge variants in one place.

import type { PartStatus } from "@/models/progress";

export interface PartStatusMeta {
  label: string;
  badgeVariant: "success" | "warning" | "muted";
}

const META: Record<PartStatus, PartStatusMeta> = {
  done: { label: "완료", badgeVariant: "success" },
  in_progress: { label: "학습 중", badgeVariant: "warning" },
  not_started: { label: "예정", badgeVariant: "muted" },
};

export function partStatusMeta(status: PartStatus): PartStatusMeta {
  return META[status];
}
