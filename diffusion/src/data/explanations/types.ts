// Shapes for per-code-cell explanations.

/** One imported library/module and where it will be used later in the notebook. */
export interface ImportNote {
  name: string; // import 이름 (예: "torch.nn", "seaborn (sns)")
  what: string; // 한 줄 정체
  use: string; // 이 노트북에서 앞으로 어디 쓰이는지
}

/** A Mermaid diagram. Complex algorithms ship a summary + a click-to-expand detail. */
export interface DiagramSpec {
  title: string; // 예: "모델 구조", "DDPM 샘플링 알고리즘"
  kind: "algorithm" | "architecture";
  summary: string; // Mermaid 코드 (항상 보임 — 축약본)
  detail?: string; // Mermaid 코드 (클릭하면 펼쳐지는 상세본)
}

export interface CodeExplanation {
  text: string; // 구어체 해석 (항상)
  imports?: ImportNote[]; // import 셀일 때 라이브러리별 미리보기
  diagram?: DiagramSpec; // 알고리즘/아키텍처 시각화
  lines?: Record<number, string>; // 핵심 줄 hover 풀이 (1-based 줄번호 → 짧은 설명)
}

/** A registry entry is either a plain verbal string, or a richer object. */
export type ExplanationEntry = string | CodeExplanation;
