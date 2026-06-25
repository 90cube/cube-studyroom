// Review session logic — picks due cards, interleaves across parts, grades and
// persists spaced-repetition state. UI stays render-only (see ReviewSession).

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReviewCard, ReviewState } from "@/models/review";
import { cardKey, isDue, loadReview, saveReview, schedule } from "@/system/reviewStorage";

/** Shuffle, then greedily avoid two cards from the same part back-to-back. */
function interleave(cards: ReviewCard[]): ReviewCard[] {
  const pool = [...cards].sort(() => Math.random() - 0.5);
  const out: ReviewCard[] = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    let i = pool.findIndex((c) => !prev || c.partId !== prev.partId);
    if (i === -1) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function useReview(ns: string, cards: ReviewCard[]) {
  const stateRef = useRef<ReviewState>(loadReview(ns));
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(0);

  // Built once per (ns, cards, round): due-or-new cards, interleaved.
  const session = useMemo(() => {
    const st = stateRef.current;
    const due = cards.filter((c) => isDue(st[cardKey(c)]));
    return interleave(due.length ? due : cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns, cards, round]);

  const total = session.length;
  const done = idx >= total;
  const current = done ? null : session[idx];

  const grade = useCallback(
    (remembered: boolean) => {
      const card = session[idx];
      if (card) {
        const k = cardKey(card);
        stateRef.current = { ...stateRef.current, [k]: schedule(stateRef.current[k], remembered) };
        saveReview(ns, stateRef.current);
      }
      setRevealed(false);
      setGraded((g) => g + 1);
      setIdx((i) => i + 1);
    },
    [ns, session, idx],
  );

  const reveal = useCallback(() => setRevealed(true), []);
  const restart = useCallback(() => {
    setIdx(0);
    setRevealed(false);
    setGraded(0);
    setRound((r) => r + 1); // rebuild session against freshly-updated due dates
  }, []);

  return { current, revealed, reveal, grade, restart, idx, total, graded, done };
}
