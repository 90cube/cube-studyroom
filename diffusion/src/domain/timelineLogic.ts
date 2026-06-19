// Pure timeline computations. No React / DOM / framework imports.

import type { TimelineEvent } from "@/models/progress";

/** Local calendar-day key (YYYY-MM-DD) for an ISO timestamp. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Sort events newest-first by `at`. Non-mutating. */
export function sortEventsDesc(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => b.at.localeCompare(a.at));
}

/** Count of distinct local calendar days that have at least one event. */
export function distinctStudyDays(events: TimelineEvent[]): number {
  const days = new Set<string>();
  for (const ev of events) days.add(localDayKey(ev.at));
  return days.size;
}

/** Local day key offset by `delta` days from today. */
function dayKeyOffset(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return localDayKey(d.toISOString());
}

/**
 * Consecutive study days ending today or yesterday.
 * Returns 0 if the most recent activity is older than yesterday.
 */
export function currentStreak(events: TimelineEvent[]): number {
  if (events.length === 0) return 0;

  const days = new Set<string>();
  for (const ev of events) days.add(localDayKey(ev.at));

  const today = dayKeyOffset(0);
  const yesterday = dayKeyOffset(-1);

  // Streak must anchor on today or yesterday, else it is broken.
  let anchor: number;
  if (days.has(today)) anchor = 0;
  else if (days.has(yesterday)) anchor = -1;
  else return 0;

  let streak = 0;
  let offset = anchor;
  while (days.has(dayKeyOffset(offset))) {
    streak += 1;
    offset -= 1;
  }
  return streak;
}
