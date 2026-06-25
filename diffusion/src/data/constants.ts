// Shared constants — no hardcoding elsewhere.

/** Public path where the preprocessor writes slim notebook JSON (diffusion topic). */
export const NOTEBOOKS_BASE = "/notebooks";

/** Theme is global across the whole studyroom. */
export const THEME_KEY = "studyroom:theme:v1";

/** Progress + timeline are namespaced per topic so they never collide. */
export function topicStorageKeys(ns: string) {
  return {
    progress: `studyroom:${ns}:progress:v1`,
    timeline: `studyroom:${ns}:timeline:v1`,
    review: `studyroom:${ns}:review:v1`,
  } as const;
}

export const COURSE_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLoSULBSCtofearln-pGND44nr69FE9eIM";

export const DIFFUSION_REPO_URL =
  "https://github.com/mohan696matlab/Diffusion_Gen_AI_Course";

export const DIFFUSERS_REPO_URL = "https://github.com/huggingface/diffusers";

export const HF_DOCS_URL = "https://huggingface.co/docs/diffusers";
