// Fetches slim notebook JSON written by the preprocessor. Single responsibility.

import { NOTEBOOKS_BASE } from "@/data/constants";
import type { Notebook, NotebookMeta } from "@/models/notebook";

/** Load one slim notebook by id. Throws on a non-ok response. */
export async function loadNotebook(id: string): Promise<Notebook> {
  const res = await fetch(`${NOTEBOOKS_BASE}/${id}.json`);
  if (!res.ok) {
    throw new Error(`노트북을 불러오지 못했습니다 (${id}): ${res.status}`);
  }
  return (await res.json()) as Notebook;
}

/** Load the notebook index. Throws on a non-ok response. */
export async function loadIndex(): Promise<NotebookMeta[]> {
  const res = await fetch(`${NOTEBOOKS_BASE}/index.json`);
  if (!res.ok) {
    throw new Error(`노트북 목록을 불러오지 못했습니다: ${res.status}`);
  }
  return (await res.json()) as NotebookMeta[];
}
