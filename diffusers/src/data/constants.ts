// Shared constants — no hardcoding elsewhere.

// Namespaced separately from the diffusion app so local progress never collides.
export const STORAGE_KEYS = {
  progress: "diffusers-study:progress:v1",
  timeline: "diffusers-study:timeline:v1",
  theme: "diffusers-study:theme:v1",
} as const;

export const COURSE_REPO_URL = "https://github.com/huggingface/diffusers";
export const HF_DOCS_URL = "https://huggingface.co/docs/diffusers";

export const TOTAL_PARTS = 8;
