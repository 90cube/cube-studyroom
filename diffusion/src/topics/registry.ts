// Topic abstraction — the studyroom hosts multiple topics, each providing its
// own curriculum, content resolver, explanations, labels and storage namespace.

import { Workflow, Boxes, Rocket, Network, type LucideIcon } from "lucide-react";
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

import { CURRICULUM as appliedCurriculum, PART_BY_SLUG as appliedBySlug } from "@/topics/applied/curriculum";
import { getExplanation as appliedGetExpl } from "@/topics/applied/explanations";
import { getDoc as getAppliedDoc } from "@/topics/applied/docLoader";

import { CURRICULUM as comfyuiCurriculum, PART_BY_SLUG as comfyuiBySlug } from "@/topics/comfyui/curriculum";
import { getExplanation as comfyuiGetExpl } from "@/topics/comfyui/explanations";
import { getDoc as getComfyuiDoc } from "@/topics/comfyui/docLoader";

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
  overview: {
    narrative:
      "이 라이브러리는 위에서 아래로 읽는다 — 순서가 곧 의존성이다. 먼저 `pipe()`가 도는 **전체 그림**을 한 바퀴 잡고(1), 그 안에 끼는 **핵심 부품**을 하나씩 줌인한다: 노이즈를 빼는 스케줄러, 예측하는 U-Net, 조종하는 어텐션, 압축하는 VAE(2~5). 부품을 알면 그 위에 **확장·응용**을 얹는다 — 구조를 강제하는 ControlNet, 어댑터를 끼우는 로더, 빠르고 가볍게 만드는 최적화(6~8). 뒤 파트는 앞 파트가 그린 지도 위에 선다.",
    map: `flowchart TD
  A["① 전체 그림<br/>파이프라인 한 바퀴 (1)"] --> B["② 핵심 부품<br/>스케줄러·U-Net·어텐션·VAE (2~5)"]
  B --> C["③ 확장·응용<br/>ControlNet·어댑터·최적화 (6~8)"]`,
  },
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

const applied: Topic = {
  slug: "applied",
  title: "응용 — 조립 & 가속",
  titleEn: "Applied: Swap & Accelerate",
  blurb: "파이프라인을 부품으로 분해·교체하고, LCM·Lightning·Turbo로 빠르게 — diffusers 다음의 실전 응용.",
  icon: Rocket,
  overview: {
    narrative:
      "diffusers에서 부품을 따로따로 봤지? 이 토픽은 그 부품을 **분해·교체·가속·조합**하는 실전이다. 파이프라인을 부품으로 쪼개 보고(1), 샘플러를 갈아끼우고(2), 느린 모델을 빠르게 바꾸는 '증류'를 LCM으로 익힌 뒤(3) Lightning·Turbo와 비교하고(4), 마지막에 부품들을 실전 레시피로 조합한다(5). 앞 토픽(diffusers)이 '부품이 뭔지'였다면, 여긴 '부품으로 뭘 하는지'다.",
    map: `flowchart TD
  A["① 분해<br/>파이프라인 = 부품 (1)"] --> B["② 교체<br/>샘플러 갈아끼우기 (2)"]
  B --> C["③ 가속<br/>증류 & LCM·Lightning·Turbo (3·4)"]
  C --> D["④ 조합<br/>실전 레시피 (5)"]`,
  },
  curriculum: appliedCurriculum,
  partBySlug: appliedBySlug,
  repoUrl: DIFFUSERS_REPO_URL,
  repoLabel: "diffusers GitHub 열기",
  refLabel: "참고 소스 · 문서",
  itemLabel: "문서",
  sectionLabel: "코드 읽기 & 사용법",
  storageNs: "applied",
  resolveCells: (id) =>
    Promise.resolve(studyToNotebookCells(getAppliedDoc(id)?.cells ?? [])),
  getExplanation: appliedGetExpl,
};

const comfyui: Topic = {
  slug: "comfyui",
  title: "ComfyUI 커스텀 노드",
  titleEn: "ComfyUI Custom Nodes",
  blurb: "노드 만드는 법(규칙·UI·실행·자원)부터 스프라이트 워크플로 응용까지 — 뭐든 만든다.",
  icon: Network,
  overview: {
    narrative:
      "ComfyUI 노드는 두 겹이다 — 계산하는 **파이썬**(백엔드)과, 화면 위젯을 그리는 **JS**(프론트). 먼저 파이썬만으로 노드의 규칙을 잡고(1), 버튼·캔버스 같은 커스텀 UI를 얹은 뒤(2), 큐·증감·조건부 같은 실행 흐름을 제어하고(3), GPU·외부 LLM 자원을 다룬 다음(4), 마지막에 이 모두를 스프라이트 워크플로로 조립한다(5). 앞 단계가 다음 단계의 부품이 된다.",
    map: `flowchart TD
  A["① 규칙<br/>파이썬 노드 = 4가지 (1)"] --> B["② UI<br/>버튼·슬라이더·캔버스 (2)"]
  B --> C["③ 흐름<br/>리스트·증감·조건부 (3)"]
  C --> D["④ 자원<br/>GPU 정리·외부 LLM (4)"]
  D --> E["⑤ 조립<br/>스프라이트 레시피 (5)"]`,
  },
  curriculum: comfyuiCurriculum,
  partBySlug: comfyuiBySlug,
  repoUrl: "https://github.com/comfyanonymous/ComfyUI",
  repoLabel: "ComfyUI GitHub 열기",
  refLabel: "참고 소스 · 문서",
  itemLabel: "문서",
  sectionLabel: "코드 읽기 & 사용법",
  storageNs: "comfyui",
  resolveCells: (id) =>
    Promise.resolve(studyToNotebookCells(getComfyuiDoc(id)?.cells ?? [])),
  getExplanation: comfyuiGetExpl,
};

export const TOPICS: Topic[] = [diffusion, diffusers, applied, comfyui];

export const TOPIC_BY_SLUG: Record<string, Topic> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t]),
);
