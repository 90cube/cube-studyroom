// Curriculum structure — type definitions only.

export interface YouTubeRef {
  title: string;
  url: string;
}

export interface PartNotebookRef {
  /** Matches NotebookMeta.id (the slim JSON id from the preprocessor). */
  id: string;
  /** Korean display label. */
  label: string;
}

/** Top-down "한눈에" panel shown before the details — big picture + knowledge chain. */
export interface PartOverview {
  hook: string; // 왜 배우나 — 한 줄 동기 (engaging)
  oneLine: string; // 이 파트의 핵심 한 문장
  prereqs: number[]; // 선수 파트 ids (gap-chaining); [] = 시작점
  unlocks: string; // 이게 가능해진다 / 다음으로 이어짐
  bigPicture: string; // Mermaid — 이 파트 핵심 흐름 (디테일 전에 보는 지도)
}

export interface Part {
  id: number; // 1..10
  slug: string; // route slug
  title: string; // English title
  titleKo: string; // Korean title
  summary: string; // Korean concept summary (markdown)
  concepts: string[]; // key terms (Korean)
  notebooks: PartNotebookRef[];
  videos: YouTubeRef[];
  overview?: PartOverview;
}
