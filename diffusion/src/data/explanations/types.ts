// Shapes for per-code-cell explanations.

/** One imported library/module and where it will be used later in the notebook. */
export interface ImportNote {
  name: string; // import 이름 (예: "torch.nn", "seaborn (sns)")
  what: string; // 한 줄 정체
  use: string; // 이 노트북에서 앞으로 어디 쓰이는지
}

export interface CodeExplanation {
  text: string; // 구어체 해석 (항상)
  imports?: ImportNote[]; // import 셀일 때 라이브러리별 미리보기
}

/** A registry entry is either a plain verbal string, or a richer object. */
export type ExplanationEntry = string | CodeExplanation;
