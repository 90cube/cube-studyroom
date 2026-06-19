// localStorage persistence for progress + timeline. Single responsibility.

import { STORAGE_KEYS } from "@/data/constants";
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

export function loadProgress(): ProgressState {
  return readJson<ProgressState>(STORAGE_KEYS.progress, {});
}

export function saveProgress(s: ProgressState): void {
  writeJson(STORAGE_KEYS.progress, s);
}

export function loadTimeline(): TimelineEvent[] {
  const data = readJson<TimelineEvent[]>(STORAGE_KEYS.timeline, []);
  return Array.isArray(data) ? data : [];
}

export function saveTimeline(e: TimelineEvent[]): void {
  writeJson(STORAGE_KEYS.timeline, e);
}
