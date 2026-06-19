// Registry of per-notebook code explanations, keyed by notebook id.
// Each value is an array indexed by code-cell order (codeIndex).
// Notebooks are added here incrementally as their explanations are authored.

import type { CodeExplanation, ExplanationEntry } from "./types";
import part1 from "./part_1_simple_diffusion__diffusion_process";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  part_1_simple_diffusion__diffusion_process: part1,
};

/** Verbal interpretation (+ optional import notes) for a notebook's k-th code cell. */
export function getExplanation(
  notebookId: string,
  codeIndex: number,
): CodeExplanation | undefined {
  const entry = EXPLANATIONS[notebookId]?.[codeIndex];
  if (entry == null) return undefined;
  return typeof entry === "string" ? { text: entry } : entry;
}

/** True if a notebook has any explanations authored (for badges/coverage UI). */
export function hasExplanations(notebookId: string): boolean {
  return (EXPLANATIONS[notebookId]?.length ?? 0) > 0;
}
