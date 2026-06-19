// Registry of per-doc code explanations, keyed by study doc id.
// Each value is an array indexed by code-cell order (codeIndex).

import type { CodeExplanation, ExplanationEntry } from "./types";
import p1Usage from "./p1_usage";
import p1Internals from "./p1_internals";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  "p1-usage": p1Usage,
  "p1-internals": p1Internals,
};

/** Verbal interpretation (+ optional imports/diagram) for a doc's k-th code cell. */
export function getExplanation(
  docId: string,
  codeIndex: number,
): CodeExplanation | undefined {
  const entry = EXPLANATIONS[docId]?.[codeIndex];
  if (entry == null) return undefined;
  return typeof entry === "string" ? { text: entry } : entry;
}
