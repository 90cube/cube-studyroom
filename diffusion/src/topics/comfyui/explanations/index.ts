// Registry of per-doc code explanations, keyed by study doc id.

import type { CodeExplanation, ExplanationEntry } from "./types";
import c1 from "./c1-first-node";
import c2 from "./c2-custom-ui";
import c3 from "./c3-execution";
import c4 from "./c4-vram-llm";
import c5 from "./c5-sprite-recipes";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  "c1-first-node": c1,
  "c2-custom-ui": c2,
  "c3-execution": c3,
  "c4-vram-llm": c4,
  "c5-sprite-recipes": c5,
};

/** Verbal interpretation (+ optional imports/diagram/lines) for a doc's k-th code cell. */
export function getExplanation(
  docId: string,
  codeIndex: number,
): CodeExplanation | undefined {
  const entry = EXPLANATIONS[docId]?.[codeIndex];
  if (entry == null) return undefined;
  return typeof entry === "string" ? { text: entry } : entry;
}
