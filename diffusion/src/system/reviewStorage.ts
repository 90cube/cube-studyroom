// localStorage persistence + Leitner-lite scheduling for review mode.
// Namespaced per topic. Single responsibility.

import { topicStorageKeys } from "@/data/constants";
import type { ReviewCard, ReviewItemState, ReviewState } from "@/models/review";

const DAY = 86_400_000;
/** Box → 다음 출제까지 간격(일). 맞힐수록 간격이 벌어진다(spacing). */
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35] as const;

export function cardKey(c: Pick<ReviewCard, "partId" | "index">): string {
  return `${c.partId}:${c.index}`;
}

export function loadReview(ns: string): ReviewState {
  try {
    const raw = localStorage.getItem(topicStorageKeys(ns).review);
    return raw ? (JSON.parse(raw) as ReviewState) : {};
  } catch {
    return {};
  }
}

export function saveReview(ns: string, state: ReviewState): void {
  try {
    localStorage.setItem(topicStorageKeys(ns).review, JSON.stringify(state));
  } catch {
    // best-effort
  }
}

/** 처음 보거나(없음) 예정 시각이 지났으면 복습 대상. */
export function isDue(s: ReviewItemState | undefined, now = Date.now()): boolean {
  return !s || s.due <= now;
}

/** 채점 결과로 다음 상태 계산: 알았으면 box+1, 틀리면 0. */
export function schedule(
  s: ReviewItemState | undefined,
  remembered: boolean,
  now = Date.now(),
): ReviewItemState {
  const box = remembered ? Math.min((s?.box ?? 0) + 1, INTERVAL_DAYS.length - 1) : 0;
  return { box, due: now + INTERVAL_DAYS[box] * DAY };
}
