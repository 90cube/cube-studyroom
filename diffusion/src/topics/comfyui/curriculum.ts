import type { Part } from "@/models/curriculum";

// "ComfyUI 커스텀 노드" 토픽 — 노드 만드는 법(규칙·UI·실행·자원) → 스프라이트 워크플로 응용.
// 사실 근거: 레포 루트 comfyui-custom-node-guide.md (ComfyUI 공식 docs + 실제 노드들로 검증).

const DOCS = "https://docs.comfy.org/custom-nodes";

export const CURRICULUM: Part[] = [
  {
    id: 1,
    slug: "first-node",
    title: "First Node & Rules",
    titleKo: "첫 노드 & 규칙",
    summary:
      "ComfyUI 노드는 두 겹이다 — 계산하는 파이썬(백엔드)과 위젯을 그리는 JS(프론트). 파이썬 클래스에 `INPUT_TYPES`·`RETURN_TYPES`·`FUNCTION`·`CATEGORY` 4가지만 적으면 동작하는 노드가 된다. 기본 위젯(숫자·슬라이더·콤보·멀티라인)은 이 4가지가 알아서 만든다. `IS_CHANGED`로 캐시를, `__init__.py`의 `NODE_CLASS_MAPPINGS`로 등록을 다룬다. 타입은 그냥 문자열 약속이라 `\"PALETTE\"` 같은 새 타입도 만들 수 있다.",
    concepts: ["두 겹(파이썬+JS)", "INPUT_TYPES / RETURN_TYPES", "FUNCTION / CATEGORY", "IS_CHANGED (캐시)", "NODE_CLASS_MAPPINGS 등록"],
    notebooks: [{ id: "c1-first-node", label: "내용" }],
    videos: [{ title: "ComfyUI docs: Server / Node 규칙", url: `${DOCS}/backend/server_overview` }],
    overview: {
      hook: "ComfyUI 노드, 생각보다 안 어려워 — 파이썬 클래스 하나에 4가지만 적으면 돼. 화면 위젯은 그 4가지가 알아서 만들어줘. JS는 버튼·캔버스 필요할 때만 나중에.",
      oneLine: "노드 = 두 겹(파이썬 계산 + JS UI). 파이썬 클래스에 INPUT_TYPES·RETURN_TYPES·FUNCTION·CATEGORY 4개면 동작하는 노드 완성.",
      prereqs: [],
      unlocks: "노드 뼈대를 잡았으니, Part 2에서 버튼·슬라이더·캔버스 같은 커스텀 UI를 얹는다.",
      bigPicture: `flowchart TD
  F["프론트엔드 (JS, LiteGraph)<br/>위젯·버튼·미리보기"] -->|"입력 전송"| B["백엔드 (Python)<br/>INPUT_TYPES·RETURN_TYPES·FUNCTION·CATEGORY"]
  B -->|"결과 텐서/문자열"| F`,
    },
  },
  {
    id: 2,
    slug: "custom-ui",
    title: "Custom UI in a Node",
    titleKo: "노드 안 커스텀 UI",
    summary:
      "기본 위젯으로 부족하면 JS 확장으로 버튼·슬라이더·미리보기·캔버스까지 노드 안에 넣는다. `app.registerExtension`의 훅에서 `node.addWidget(\"button\", …)`로 버튼을, `node.addDOMWidget(…)`로 임의의 HTML(캔버스 등)을, `OUTPUT_NODE` + `{ui:{images}}`로 미리보기를 만든다. LiteGraph의 `onDrawForeground`·`onMouseDown` 훅으로 직접 그리고 클릭도 받는다.",
    concepts: ["app.registerExtension", "addWidget (버튼)", "addDOMWidget (캔버스/HTML)", "OUTPUT_NODE 미리보기", "LiteGraph 훅"],
    notebooks: [{ id: "c2-custom-ui", label: "내용" }],
    videos: [{ title: "ComfyUI docs: JavaScript Extensions", url: `${DOCS}/js/javascript_overview` }],
    overview: {
      hook: "기본 위젯(숫자·콤보)으로 부족해? 버튼·슬라이더·미리보기, 심지어 그림 그리는 캔버스까지 노드 안에 넣을 수 있어 — JS 확장으로.",
      oneLine: "app.registerExtension + addWidget(버튼)·addDOMWidget(캔버스 등 HTML)·OUTPUT_NODE 미리보기로 커스텀 UI를 노드에 박는다.",
      prereqs: [1],
      unlocks: "캔버스를 다룰 줄 알면, Part 5의 '페인팅 후 마스크 출력' 노드를 직접 만들 수 있다.",
      bigPicture: `flowchart LR
  E["app.registerExtension"] --> W["addWidget: 버튼"]
  E --> D["addDOMWidget: 캔버스/미리보기"]
  E --> H["LiteGraph 훅<br/>onDrawForeground · onMouseDown"]`,
    },
  },
  {
    id: 3,
    slug: "execution",
    title: "Execution Flow",
    titleKo: "실행 흐름 제어",
    summary:
      "노드는 한 번만 실행하는 게 아니다. `OUTPUT_IS_LIST=(True,)`로 리스트를 출력하면 다운스트림이 N번 자동 실행(같은 프롬프트, 다른 이미지 i2i가 이걸로 된다). INT 위젯의 `control_after_generate`로 매 큐마다 순차증가/감소/랜덤. 조건부 출력은 `lazy` 입력 + `check_lazy_status`로 필요한 가지만 계산하거나, `ExecutionBlocker`로 가지 전체를 끊는다.",
    concepts: ["OUTPUT_IS_LIST (N번 실행)", "INPUT_IS_LIST", "control_after_generate (증감/랜덤)", "lazy / check_lazy_status", "ExecutionBlocker (분기)"],
    notebooks: [{ id: "c3-execution", label: "내용" }],
    videos: [{ title: "ComfyUI docs: Data lists", url: `${DOCS}/backend/lists` }],
    overview: {
      hook: "노드가 '한 번 실행'만 하는 게 아니야 — 리스트로 N번 돌리고, 매번 숫자를 증감/랜덤하고, 조건에 따라 가지를 끊을 수 있어. 큐를 자유자재로.",
      oneLine: "OUTPUT_IS_LIST(N번 실행) · control_after_generate(증감/랜덤) · lazy/ExecutionBlocker(조건부 분기)로 실행 흐름을 제어한다.",
      prereqs: [1],
      unlocks: "리스트 실행을 알면, Part 5의 '이미지 N장을 같은 프롬프트로 순차 i2i'가 그냥 된다.",
      bigPicture: `flowchart TD
  L["이미지 N장 (OUTPUT_IS_LIST)"] --> K["KSampler — N번 자동 실행"]
  C["control_after_generate<br/>(순차증가/감소/랜덤)"] --> K
  X{"조건?"} -->|"통과"| K
  X -->|"차단"| B["ExecutionBlocker — 가지 끊기"]`,
    },
  },
  {
    id: 4,
    slug: "vram-llm",
    title: "VRAM & External LLM",
    titleKo: "GPU 정리 & 외부 LLM",
    summary:
      "무거운 파이프라인에선 VRAM 관리가 핵심. 출력이 끝나면 `comfy.model_management.unload_all_models()` + `soft_empty_cache()` + `torch.cuda.empty_cache()`로 자리를 비운다. llama.cpp를 API 서버로 띄웠으면 노드는 `requests.post`로 호출만 하고, 끝나면 디퓨전 모델을 언로드해 다음 단계에 메모리를 내준다.",
    concepts: ["model_management.unload_all_models", "soft_empty_cache", "torch.cuda.empty_cache", "llama.cpp API 연동", "출력 후 클린업"],
    notebooks: [{ id: "c4-vram-llm", label: "내용" }],
    videos: [{ title: "참고: ComfyUI-Unload-Model", url: "https://github.com/SeanScripts/ComfyUI-Unload-Model" }],
    overview: {
      hook: "이미지 뽑고 LLM까지 돌리면 GPU가 빡빡하지. 출력 끝나면 모델을 언로드해 자리를 비우고, llama.cpp API로 LLM을 붙이는 법.",
      oneLine: "comfy.model_management.unload_all_models()+soft_empty_cache()로 VRAM을 비우고, requests로 llamacpp API를 호출해 프롬프트를 생성한다.",
      prereqs: [1],
      unlocks: "자원 관리를 알면, Part 5의 무거운 스프라이트 파이프라인도 메모리 터짐 없이 돌린다.",
      bigPicture: `flowchart LR
  P["프롬프트 생성<br/>requests.post(llama.cpp)"] --> G["생성/i2i"]
  G --> C["cleanup_vram()<br/>unload + empty_cache"]
  C --> N["다음 단계에 VRAM 양보"]`,
    },
  },
  {
    id: 5,
    slug: "sprite-recipes",
    title: "Sprite Workflow Recipes",
    titleKo: "스프라이트 응용 레시피",
    summary:
      "앞에서 익힌 UI·실행·자원 노드를 묶어 진짜 목표 — 스프라이트 시트 작업을 조립한다. 참조 이미지로 프롬프트 생성, SAM3로 부위 마스킹, 낮은 denoise i2i로 스타일 유지하며 색/스타일 변경, 색상 양자화(median-cut/k-means)와 픽셀 스냅(nearest·그리드)으로 픽셀퍼펙트 보정. 순수 numpy/PIL 노드 + 리스트 실행으로 여러 부위를 같은 프롬프트로 일괄 처리.",
    concepts: ["SAM3 마스킹 노드", "페인팅 + 마스크 출력", "픽셀 스냅 (전후 비교)", "색상 양자화 + 팔레트", "리스트 i2i 조립"],
    notebooks: [{ id: "c5-sprite-recipes", label: "내용" }],
    videos: [
      { title: "참고: 페인팅 캔버스 LayerForge", url: "https://github.com/Azornes/Comfyui-LayerForge" },
      { title: "참고: ControlFlowUtils (분기/언로드)", url: "https://comfy.icu/extension/VykosX__ControlFlowUtils" },
    ],
    overview: {
      hook: "이제 다 배웠으니 진짜 목표 — 스프라이트 시트 작업. 참조→프롬프트, SAM3 마스킹, 스타일 유지한 채 색만 바꾸기, 픽셀 스냅, 색상 양자화를 노드로 조립해.",
      oneLine: "UI·실행·자원 노드를 묶어 스프라이트 워크플로를 만든다: SAM3 마스크 + 낮은 denoise i2i(스타일 유지) + 색상 양자화 + 픽셀 스냅.",
      prereqs: [2, 3, 4],
      unlocks: "여기까지면 ComfyUI에서 상상하는 거의 모든 노드를 직접 만들 수 있다.",
      bigPicture: `flowchart LR
  R["참조 스프라이트"] --> M["SAM3 부위 마스크"]
  M --> I["낮은 denoise i2i<br/>(스타일 유지 · 색 변경)"]
  I --> Q["색상 양자화 + 팔레트"]
  Q --> S["픽셀 스냅 (전/후 비교)"]`,
    },
  },
];

export const PART_BY_SLUG: Record<string, Part> = Object.fromEntries(
  CURRICULUM.map((p) => [p.slug, p]),
);
