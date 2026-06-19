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

export interface Part {
  id: number; // 1..10
  slug: string; // route slug
  title: string; // English title
  titleKo: string; // Korean title
  summary: string; // Korean concept summary (markdown)
  concepts: string[]; // key terms (Korean)
  notebooks: PartNotebookRef[];
  videos: YouTubeRef[];
}
