// Registry of per-doc code explanations, keyed by study doc id.
// Each value is an array indexed by code-cell order (codeIndex).

import type { CodeExplanation, ExplanationEntry } from "./types";
import p1Usage from "./p1_usage";
import p1Internals from "./p1_internals";
import p2Scheduler from "./p2_scheduler";
import p3Unet from "./p3_unet";
import p4Attention from "./p4_attention";
import p5Vae from "./p5_vae";
import p6Controlnet from "./p6_controlnet";
import p7Loaders from "./p7_loaders";
import p8Optimization from "./p8_optimization";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  "p1-usage": p1Usage,
  "p1-internals": p1Internals,
  "p2-scheduler": p2Scheduler,
  "p3-unet": p3Unet,
  "p4-attention": p4Attention,
  "p5-vae": p5Vae,
  "p6-controlnet": p6Controlnet,
  "p7-loaders": p7Loaders,
  "p8-optimization": p8Optimization,
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
