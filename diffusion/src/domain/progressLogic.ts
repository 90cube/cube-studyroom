// Pure progress computations. No React / DOM / framework imports.

import type { Part } from "@/models/curriculum";
import type {
  OverallStats,
  PartProgress,
  PartStatus,
  ProgressState,
} from "@/models/progress";

/** Count notebooks marked done within a part's progress record. */
function countDone(part: Part, pp?: PartProgress): number {
  if (!pp) return 0;
  let done = 0;
  for (const ref of part.notebooks) {
    if (pp.notebooks[ref.id]?.status === "done") done += 1;
  }
  return done;
}

/**
 * Derive a part's status purely from its notebook completion.
 * all done -> "done"; some done -> "in_progress"; none -> "not_started".
 */
export function computePartStatus(part: Part, pp?: PartProgress): PartStatus {
  const total = part.notebooks.length;
  if (total === 0) return "not_started";
  const done = countDone(part, pp);
  if (done >= total) return "done";
  if (done > 0) return "in_progress";
  return "not_started";
}

/** Completion percentage of a part (0..100, rounded). */
export function computePartPercent(part: Part, pp?: PartProgress): number {
  const total = part.notebooks.length;
  if (total === 0) return 0;
  return Math.round((countDone(part, pp) / total) * 100);
}

/** Aggregate progress across the whole curriculum. */
export function computeOverall(
  curriculum: Part[],
  state: ProgressState,
): OverallStats {
  let completedParts = 0;
  let completedNotebooks = 0;
  let totalNotebooks = 0;

  for (const part of curriculum) {
    const pp = state[part.id];
    totalNotebooks += part.notebooks.length;
    const done = countDone(part, pp);
    completedNotebooks += done;
    if (part.notebooks.length > 0 && done >= part.notebooks.length) {
      completedParts += 1;
    }
  }

  const totalParts = curriculum.length;
  const percent =
    totalNotebooks === 0
      ? 0
      : Math.round((completedNotebooks / totalNotebooks) * 100);

  return {
    percent,
    completedParts,
    totalParts,
    completedNotebooks,
    totalNotebooks,
  };
}
