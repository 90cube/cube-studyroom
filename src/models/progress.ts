// Learning progress + timeline shapes — type definitions only.

export type PartStatus = "not_started" | "in_progress" | "done";

export interface NotebookProgress {
  status: PartStatus;
  completedAt?: string; // ISO timestamp
}

export interface PartProgress {
  status: PartStatus;
  notebooks: Record<string, NotebookProgress>; // keyed by notebook id
  memo: string;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

/** Keyed by part id (1..10). */
export type ProgressState = Record<number, PartProgress>;

export interface OverallStats {
  percent: number; // 0..100
  completedParts: number;
  totalParts: number;
  completedNotebooks: number;
  totalNotebooks: number;
}

export type TimelineEventType =
  | "part_started"
  | "part_completed"
  | "notebook_completed"
  | "memo_updated";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  partId: number;
  notebookId?: string;
  at: string; // ISO timestamp
}
