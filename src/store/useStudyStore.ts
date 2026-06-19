// Single source of truth for learning progress + timeline (React hook).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CURRICULUM } from "@/data/curriculum";
import { computeOverall, computePartStatus } from "@/domain/progressLogic";
import { localDayKey } from "@/domain/timelineLogic";
import {
  loadProgress,
  loadTimeline,
  saveProgress,
  saveTimeline,
} from "@/system/storage";
import type {
  OverallStats,
  PartProgress,
  ProgressState,
  TimelineEvent,
  TimelineEventType,
} from "@/models/progress";

export interface StudyStore {
  progress: ProgressState;
  timeline: TimelineEvent[];
  getPart(partId: number): PartProgress;
  toggleNotebookDone(partId: number, notebookId: string): void;
  setMemo(partId: number, memo: string): void;
  resetPart(partId: number): void;
  overall: OverallStats;
}

const MEMO_DEBOUNCE_MS = 600;

function defaultPart(): PartProgress {
  return { status: "not_started", notebooks: {}, memo: "" };
}

function partById(partId: number) {
  return CURRICULUM.find((p) => p.id === partId);
}

function makeEvent(
  type: TimelineEventType,
  partId: number,
  notebookId?: string,
): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    type,
    partId,
    notebookId,
    at: new Date().toISOString(),
  };
}

export function useStudyStore(): StudyStore {
  const [progress, setProgress] = useState<ProgressState>({});
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgress = useRef<ProgressState | null>(null);

  // Load persisted state on mount.
  useEffect(() => {
    setProgress(loadProgress());
    setTimeline(loadTimeline());
  }, []);

  const getPart = useCallback(
    (partId: number): PartProgress => progress[partId] ?? defaultPart(),
    [progress],
  );

  const toggleNotebookDone = useCallback(
    (partId: number, notebookId: string) => {
      const part = partById(partId);
      if (!part) return;
      const now = new Date().toISOString();
      const events: TimelineEvent[] = [];

      setProgress((prev) => {
        const cur = prev[partId] ?? defaultPart();
        const wasDone = cur.notebooks[notebookId]?.status === "done";

        const notebooks: PartProgress["notebooks"] = {
          ...cur.notebooks,
          [notebookId]: {
            status: wasDone ? "not_started" : "done",
            completedAt: wasDone ? undefined : now,
          },
        };

        const prevPartStatus = cur.status;
        const next: PartProgress = { ...cur, notebooks, updatedAt: now };
        next.status = computePartStatus(part, next);

        if (!wasDone) events.push(makeEvent("notebook_completed", partId, notebookId));

        if (next.status === "in_progress" && prevPartStatus === "not_started") {
          next.startedAt = cur.startedAt ?? now;
          events.push(makeEvent("part_started", partId));
        }
        if (next.status === "done" && prevPartStatus !== "done") {
          next.completedAt = now;
          if (!next.startedAt) next.startedAt = cur.startedAt ?? now;
          events.push(makeEvent("part_completed", partId));
        }
        if (next.status !== "done") next.completedAt = undefined;

        const updated = { ...prev, [partId]: next };
        saveProgress(updated);
        return updated;
      });

      if (events.length > 0) {
        setTimeline((prev) => {
          const updated = [...prev, ...events];
          saveTimeline(updated);
          return updated;
        });
      }
    },
    [],
  );

  const setMemo = useCallback((partId: number, memo: string) => {
    const now = new Date().toISOString();

    setProgress((prev) => {
      const cur = prev[partId] ?? defaultPart();
      const updated = {
        ...prev,
        [partId]: { ...cur, memo, updatedAt: now },
      };
      pendingProgress.current = updated;
      return updated;
    });

    // Emit at most one memo_updated per part per local day.
    setTimeline((prev) => {
      const dayKey = localDayKey(now);
      const already = prev.some(
        (e) =>
          e.type === "memo_updated" &&
          e.partId === partId &&
          localDayKey(e.at) === dayKey,
      );
      if (already) return prev;
      const updated = [...prev, makeEvent("memo_updated", partId)];
      saveTimeline(updated);
      return updated;
    });

    if (memoTimer.current) clearTimeout(memoTimer.current);
    memoTimer.current = setTimeout(() => {
      if (pendingProgress.current) saveProgress(pendingProgress.current);
      pendingProgress.current = null;
    }, MEMO_DEBOUNCE_MS);
  }, []);

  const resetPart = useCallback((partId: number) => {
    setProgress((prev) => {
      const updated = { ...prev, [partId]: defaultPart() };
      saveProgress(updated);
      return updated;
    });
  }, []);

  const overall = useMemo(
    () => computeOverall(CURRICULUM, progress),
    [progress],
  );

  return {
    progress,
    timeline,
    getPart,
    toggleNotebookDone,
    setMemo,
    resetPart,
    overall,
  };
}
