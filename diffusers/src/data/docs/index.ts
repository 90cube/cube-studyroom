import type { StudyDoc } from "@/models/study";
import p1Usage from "./p1_usage";
import p1Internals from "./p1_internals";

// Authored study docs, keyed by id. Parts are filled in incrementally.
export const DOCS: Record<string, StudyDoc> = {
  [p1Usage.id]: p1Usage,
  [p1Internals.id]: p1Internals,
};
