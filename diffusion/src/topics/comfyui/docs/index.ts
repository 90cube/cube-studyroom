import type { StudyDoc } from "@/models/study";
import c1 from "./c1-first-node";
import c2 from "./c2-custom-ui";
import c3 from "./c3-execution";
import c4 from "./c4-vram-llm";
import c5 from "./c5-sprite-recipes";

// Authored study docs, keyed by id.
export const DOCS: Record<string, StudyDoc> = {
  [c1.id]: c1,
  [c2.id]: c2,
  [c3.id]: c3,
  [c4.id]: c4,
  [c5.id]: c5,
};
