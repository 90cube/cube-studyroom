// Registry of per-doc code explanations, keyed by study doc id.

import type { CodeExplanation, ExplanationEntry } from "./types";
import a1 from "./a1_pipeline_parts";
import a2 from "./a2_samplers";
import a3 from "./a3_lcm";
import a4 from "./a4_distill_zoo";
import a5 from "./a5_swap_recipes";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  "a1-pipeline-parts": a1,
  "a2-samplers": a2,
  "a3-lcm": a3,
  "a4-distill-zoo": a4,
  "a5-swap-recipes": a5,
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
