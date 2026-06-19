// Registry of per-notebook code explanations, keyed by notebook id.
// Each value is an array indexed by code-cell order (codeIndex).

import type { CodeExplanation, ExplanationEntry } from "./types";
import p1 from "./part_1_simple_diffusion__diffusion_process";
import p2_1 from "./part_2_mnist_diffusion__part_2_1_diffusion_from_scratch_pytorch";
import p2_2 from "./part_2_mnist_diffusion__part_2_2_huggingface_diffusers";
import p3_1 from "./part_3_diffusion_celeb_faces__part_3_1_celeb_face";
import p4_1 from "./part_4_image_editing_with_diffusion__part_4_1_inpainiting";
import p4_2 from "./part_4_image_editing_with_diffusion__part_4_2_image_compositing";
import p5_1 from "./part_5_latent_diffusion_model__part_5_1_ldm_on_celeb_faces";
import p6_1 from "./part_6_SD_text_conditioning__part_6_1_text_conditioning";
import p6_2 from "./part_6_SD_text_conditioning__part_6_2_SD15_inpainting_img2img";
import p7_1 from "./part_7_controlnet__part_7_1_controlnet";
import p7_2 from "./part_7_controlnet__part_7_2_open_pose_multi_controlnet";
import p8_1 from "./part_8_ipadapters__part_8_1_ipadapter";
import p8_2 from "./part_8_ipadapters__part_8_2_ipadapter_controlnet";
import p8_3 from "./part_8_ipadapters__part_8_3_face_ipadapter";
import p9_1 from "./part_9_LoRA_finetuning__part_9_1_load_lora";
import p9_2 from "./part_9_LoRA_finetuning__part_9_2_finetuning_diffusion";
import p10_1 from "./part_10_inference_optimization__part_10_1_LCM";
import p10_2 from "./part_10_inference_optimization__part_10_2_quantization_less_VRAM";

const EXPLANATIONS: Record<string, ExplanationEntry[]> = {
  part_1_simple_diffusion__diffusion_process: p1,
  part_2_mnist_diffusion__part_2_1_diffusion_from_scratch_pytorch: p2_1,
  part_2_mnist_diffusion__part_2_2_huggingface_diffusers: p2_2,
  part_3_diffusion_celeb_faces__part_3_1_celeb_face: p3_1,
  part_4_image_editing_with_diffusion__part_4_1_inpainiting: p4_1,
  part_4_image_editing_with_diffusion__part_4_2_image_compositing: p4_2,
  part_5_latent_diffusion_model__part_5_1_ldm_on_celeb_faces: p5_1,
  part_6_SD_text_conditioning__part_6_1_text_conditioning: p6_1,
  part_6_SD_text_conditioning__part_6_2_SD15_inpainting_img2img: p6_2,
  part_7_controlnet__part_7_1_controlnet: p7_1,
  part_7_controlnet__part_7_2_open_pose_multi_controlnet: p7_2,
  part_8_ipadapters__part_8_1_ipadapter: p8_1,
  part_8_ipadapters__part_8_2_ipadapter_controlnet: p8_2,
  part_8_ipadapters__part_8_3_face_ipadapter: p8_3,
  part_9_LoRA_finetuning__part_9_1_load_lora: p9_1,
  part_9_LoRA_finetuning__part_9_2_finetuning_diffusion: p9_2,
  part_10_inference_optimization__part_10_1_LCM: p10_1,
  part_10_inference_optimization__part_10_2_quantization_less_VRAM: p10_2,
};

/** Verbal interpretation (+ optional import notes / diagram) for a notebook's k-th code cell. */
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
