// A study document = curated, authored content for one topic (no notebook
// outputs). Code cells carry real diffusers source excerpts or usage snippets.

export type StudyCell =
  | { type: "markdown"; source: string }
  | { type: "code"; source: string };

export interface StudyDoc {
  id: string; // matches a Part's doc ref id + the explanations key
  title: string;
  cells: StudyCell[];
}
