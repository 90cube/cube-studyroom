// Slim notebook shapes emitted by scripts/build-notebooks.mjs.
// State/type definitions only — no computation.

export type NotebookOutput =
  | { kind: "stream"; name: string; text: string }
  | { kind: "error"; ename: string; evalue: string; traceback: string }
  | { kind: "image"; src: string }
  | { kind: "html"; html: string }
  | { kind: "text"; text: string };

export type NotebookCell =
  | { type: "markdown"; source: string }
  | { type: "code"; source: string; outputs: NotebookOutput[] };

export interface Notebook {
  id: string;
  part: number;
  dir: string;
  file: string;
  title: string;
  cells: NotebookCell[];
}

export interface NotebookMeta {
  id: string;
  part: number;
  dir: string;
  file: string;
  title: string;
  cellCount: number;
  codeCount: number;
  mdCount: number;
}
