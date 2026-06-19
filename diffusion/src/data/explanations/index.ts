// Registry of per-notebook code explanations, keyed by notebook id.
// Each value is an array indexed by code-cell order (codeIndex).
// Notebooks are added here incrementally as their explanations are authored.

import part1 from "./part_1_simple_diffusion__diffusion_process";

const EXPLANATIONS: Record<string, string[]> = {
  part_1_simple_diffusion__diffusion_process: part1,
};

/** Verbal interpretation for the given notebook's k-th code cell, if authored. */
export function getExplanation(
  notebookId: string,
  codeIndex: number,
): string | undefined {
  return EXPLANATIONS[notebookId]?.[codeIndex];
}

/** True if a notebook has any explanations authored (for badges/coverage UI). */
export function hasExplanations(notebookId: string): boolean {
  return (EXPLANATIONS[notebookId]?.length ?? 0) > 0;
}
