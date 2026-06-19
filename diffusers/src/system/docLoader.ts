import type { StudyDoc } from "@/models/study";
import { DOCS } from "@/data/docs";

/** Authored study content is bundled (not fetched), so this is synchronous. */
export function getDoc(id: string): StudyDoc | undefined {
  return DOCS[id];
}
