import type { StudyDoc } from "@/models/study";
import a1 from "./a1_pipeline_parts";
import a2 from "./a2_samplers";
import a3 from "./a3_lcm";
import a4 from "./a4_distill_zoo";
import a5 from "./a5_swap_recipes";

// Authored study docs, keyed by id.
export const DOCS: Record<string, StudyDoc> = {
  [a1.id]: a1,
  [a2.id]: a2,
  [a3.id]: a3,
  [a4.id]: a4,
  [a5.id]: a5,
};
