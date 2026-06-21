// Shapes for per-code-cell explanations.

/** One imported library/module and where it will be used later. */
export interface ImportNote {
  name: string; // import 이름
  what: string; // 한 줄 정체
  use: string; // 앞으로 어디 쓰이는지
}

/** A Mermaid diagram. Complex algorithms ship a summary + a click-to-expand detail. */
export interface DiagramSpec {
  title: string;
  kind: "algorithm" | "architecture";
  summary: string; // Mermaid 코드 (축약본)
  detail?: string; // Mermaid 코드 (펼치는 상세본)
}

export interface CodeExplanation {
  text: string;
  imports?: ImportNote[];
  diagram?: DiagramSpec;
  lines?: Record<number, string>; // 핵심 줄 hover 풀이 (1-based 줄번호 → 짧은 설명)
}

export type ExplanationEntry = string | CodeExplanation;
