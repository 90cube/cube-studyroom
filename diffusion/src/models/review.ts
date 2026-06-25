// Review-mode types — spaced, interleaved retrieval over a topic's recall items.

/** One recall question flattened out of a part, ready to drill. */
export interface ReviewCard {
  partId: number;
  partSlug: string;
  partTitleKo: string;
  index: number; // 파트 내 recall 배열에서의 위치
  q: string;
  a: string;
  hint?: string;
}

/** Per-card spaced-repetition state (Leitner-lite). */
export interface ReviewItemState {
  box: number; // 0..5 — 맞힐수록 올라가고, 틀리면 0으로
  due: number; // epoch ms — 이 시각 이후 다시 출제
}

/** Persisted per topic, keyed by `${partId}:${index}`. */
export type ReviewState = Record<string, ReviewItemState>;
