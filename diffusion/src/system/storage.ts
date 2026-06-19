// localStorage persistence for progress + timeline, namespaced per topic.
// Single responsibility.

import { topicStorageKeys } from "@/data/constants";
import type { ProgressState, TimelineEvent } from "@/models/progress";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / unavailable storage — swallow; persistence is best-effort.
  }
}

export function loadProgress(ns: string): ProgressState {
  return readJson<ProgressState>(topicStorageKeys(ns).progress, {});
}

export function saveProgress(ns: string, s: ProgressState): void {
  writeJson(topicStorageKeys(ns).progress, s);
}

export function loadTimeline(ns: string): TimelineEvent[] {
  const data = readJson<TimelineEvent[]>(topicStorageKeys(ns).timeline, []);
  return Array.isArray(data) ? data : [];
}

export function saveTimeline(ns: string, e: TimelineEvent[]): void {
  writeJson(topicStorageKeys(ns).timeline, e);
}
