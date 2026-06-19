// Topic abstraction — the studyroom hosts multiple topics, each providing its
// own curriculum, content resolver, explanations, labels and storage namespace.

import { Workflow, Boxes, type LucideIcon } from "lucide-react";
import type { Part } from "@/models/curriculum";
import type { NotebookCell } from "@/models/notebook";
import type { StudyCell } from "@/models/study";
import type { CodeExplanation } from "@/data/explanations/types";
import { DIFFUSION_REPO_URL, DIFFUSERS_REPO_URL } from "@/data/constants";

import { CURRICULUM as diffusionCurriculum, PART_BY_SLUG as diffusionBySlug } from "@/data/curriculum";
import { getExplanation as diffusionGetExpl } from "@/data/explanations";
import { loadNotebook } from "@/system/notebookLoader";

import { CURRICULUM as diffusersCurriculum, PART_BY_SLUG as diffusersBySlug } from "@/topics/diffusers/curriculum";
import { getExplanation as diffusersGetExpl } from "@/topics/diffusers/explanations";
import { getDoc } from "@/topics/diffusers/docLoader";

/** The whole-topic map shown on the dashboard — top-down before the part list. */
export interface TopicOverview {
  narrative: string; // 이 주제는 이렇게 흐른다 (markdown)
  map: string; // Mermaid — 전체 파트 흐름/스테이지
}

export interface Topic {
  slug: string;
  title: string;
  titleEn: string;
  blurb: string;
  icon: LucideIcon;
  overview?: TopicOverview;
  curriculum: Part[];
  partBySlug: Record<string, Part>;
  repoUrl: string;
  repoLabel: string;
  refLabel: string; // sidebar references card title
  itemLabel: string; // "노트북" | "문서"
  sectionLabel: string; // heading above the content viewer
  storageNs: string;
  resolveCells(docId: string): Promise<NotebookCell[]>;
  getExplanation(docId: string, codeIndex: number): CodeExplanation | undefined;
}

function studyToNotebookCells(cells: StudyCell[]): NotebookCell[] {
  return cells.map((c) =>
    c.type === "markdown"
      ? { type: "markdown", source: c.source }
      : { type: "code", source: c.source, outputs: [] },
  );
}

const diffusion: Topic = {
  slug: "diffusion",
  title: "디퓨전 강의",
  titleEn: "Diffusion & Gen AI",
  blurb: "노이즈에서 이미지가 태어나는 원리를, 직접 짠 코드로 10파트에 걸쳐 따라간다.",
  icon: Workflow,
  overview: {
    narrative:
      "이 강의는 '노이즈를 다루는 법'을 한 겹씩 쌓아 올린다. 먼저 노이즈↔데이터를 오가는 **원리**를 가장 작은 데이터로 잡고(1·2), 그걸 **진짜 이미지**로 키운다(3). 그다음 이미 학습된 모델을 **편집·압축·조건화**하는 법으로 넓히고(4·5·6), 마지막으로 **정밀 제어와 효율**로 마무리한다(7~10). 뒤 파트는 앞 파트 위에 선다 — 순서가 곧 의존성이다.",
    map: `flowchart TD
  A["① 원리<br/>노이즈↔데이터 (1·2)"] --> B["② 키우기<br/>실제 얼굴 scratch (3)"]
  B --> C["③ 다루기<br/>편집·LDM·텍스트 (4·5·6)"]
  C --> D["④ 제어<br/>ControlNet·IP-Adapter (7·8)"]
  D --> E["⑤ 커스텀·효율<br/>LoRA·최적화 (9·10)"]`,
  },
  curriculum: diffusionCurriculum,
  partBySlug: diffusionBySlug,
  repoUrl: DIFFUSION_REPO_URL,
  repoLabel: "강의 저장소 열기",
  refLabel: "강의 영상",
  itemLabel: "노트북",
  sectionLabel: "노트북",
  storageNs: "diffusion",
  resolveCells: (id) => loadNotebook(id).then((nb) => nb.cells),
  getExplanation: diffusionGetExpl,
};

const diffusers: Topic = {
  slug: "diffusers",
  title: "diffusers 라이브러리",
  titleEn: "Hugging Face diffusers",
  blurb: "실전 라이브러리는 어떻게 돌아가나 — 핵심 소스를 읽고 응용까지 8파트.",
  icon: Boxes,
  curriculum: diffusersCurriculum,
  partBySlug: diffusersBySlug,
  repoUrl: DIFFUSERS_REPO_URL,
  repoLabel: "diffusers GitHub 열기",
  refLabel: "참고 소스 · 문서",
  itemLabel: "문서",
  sectionLabel: "코드 읽기 & 사용법",
  storageNs: "diffusers",
  resolveCells: (id) => Promise.resolve(studyToNotebookCells(getDoc(id)?.cells ?? [])),
  getExplanation: diffusersGetExpl,
};

export const TOPICS: Topic[] = [diffusion, diffusers];

export const TOPIC_BY_SLUG: Record<string, Topic> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t]),
);
