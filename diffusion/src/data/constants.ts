// Shared constants — no hardcoding elsewhere.

export const STORAGE_KEYS = {
  progress: "diffusion-study:progress:v1",
  timeline: "diffusion-study:timeline:v1",
  theme: "diffusion-study:theme:v1",
} as const;

/** Public path where the preprocessor writes slim notebook JSON. */
export const NOTEBOOKS_BASE = "/notebooks";

export const COURSE_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLoSULBSCtofearln-pGND44nr69FE9eIM";

export const COURSE_REPO_URL =
  "https://github.com/mohan696matlab/Diffusion_Gen_AI_Course";

export const TOTAL_PARTS = 10;
