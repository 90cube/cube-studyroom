import type { StudyDoc } from "@/models/study";
import p1Usage from "./p1_usage";
import p1Internals from "./p1_internals";
import p2Scheduler from "./p2_scheduler";
import p3Unet from "./p3_unet";
import p4Attention from "./p4_attention";
import p5Vae from "./p5_vae";
import p6Controlnet from "./p6_controlnet";
import p7Loaders from "./p7_loaders";
import p8Optimization from "./p8_optimization";

// Authored study docs, keyed by id.
export const DOCS: Record<string, StudyDoc> = {
  [p1Usage.id]: p1Usage,
  [p1Internals.id]: p1Internals,
  [p2Scheduler.id]: p2Scheduler,
  [p3Unet.id]: p3Unet,
  [p4Attention.id]: p4Attention,
  [p5Vae.id]: p5Vae,
  [p6Controlnet.id]: p6Controlnet,
  [p7Loaders.id]: p7Loaders,
  [p8Optimization.id]: p8Optimization,
};
