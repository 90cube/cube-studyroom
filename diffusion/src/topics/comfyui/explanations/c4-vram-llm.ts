import type { ExplanationEntry } from "./types";

// 코드 셀 2개에 1:1 대응 — [0] cleanup_vram 헬퍼, [1] LlamaCppPrompt 노드.

const explanations: ExplanationEntry[] = [
  // 0 — cleanup_vram() 헬퍼
  {
    text: "VRAM 비우는 네 단계를 순서대로 밟아. 먼저 mm.unload_all_models()로 Comfy가 쥐고 있는 모델을 GPU에서 내려 — 이게 제일 중요해. 그다음 soft_empty_cache()로 Comfy 내부 캐시를 정리하고, gc.collect()로 파이썬이 안 쓰는 객체를 수거해. 마지막에야 torch.cuda.empty_cache()가 파이토치가 예약해둔 캐시 블록을 드라이버에 돌려줘. 순서가 핵심이야 — 앞 셋을 건너뛰고 empty_cache()만 부르면 아직 참조가 살아있어서 거의 안 비워져.",
    imports: [
      {
        name: "comfy.model_management (as mm)",
        what: "ComfyUI가 모델을 GPU에 올렸다 내렸다 관리하는 내부 모듈",
        use: "unload_all_models()로 디퓨전 모델 언로드, soft_empty_cache()로 캐시 정리",
      },
      {
        name: "gc",
        what: "파이썬 표준 가비지 컬렉터",
        use: "collect()로 순환참조까지 즉시 수거해 텐서 참조를 끊어줌",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서·CUDA",
        use: "cuda.is_available() 확인 후 cuda.empty_cache()로 캐시 반환",
      },
    ],
    diagram: {
      title: "cleanup_vram — 자리를 비우는 4단계",
      kind: "algorithm",
      summary: `flowchart TD
  S["cleanup_vram() 호출"] --> Q{"unload_models ?"}
  Q -->|"예"| U["① mm.unload_all_models()<br/>모델 GPU→밖으로"]
  Q -->|"아니오"| C
  U --> C["② mm.soft_empty_cache()"]
  C --> G["③ gc.collect()"]
  G --> T{"cuda 사용가능?"}
  T -->|"예"| E["④ torch.cuda.empty_cache()<br/>드라이버에 반환"]
  T -->|"아니오"| DONE["끝 — VRAM 확보"]
  E --> DONE`,
    },
    lines: {
      9: "unload_all_models(): Comfy가 관리하는 모델을 GPU에서 내려. 자리를 비우는 진짜 핵심 한 줄.",
      10: "soft_empty_cache(): Comfy 내부의 모델 캐시를 정리 — 언로드 다음에 불러야 효과.",
      13: "torch.cuda.empty_cache(): 파이토치가 쥔 캐시 블록을 드라이버에 반환. 앞 3단계 뒤에 와야 실제로 비워짐.",
    },
  },
  // 1 — LlamaCppPrompt 노드
  {
    text: "외부 LLM을 HTTP로만 붙이는 노드야. INPUT_TYPES에 서버 주소·지시문·토큰수·정리여부를 받고, generate()에서 requests.post로 llama.cpp 서버의 OpenAI 호환 엔드포인트를 때려. 포인트: LLM의 VRAM은 그 서버 프로세스가 들고 있어서 ComfyUI 쪽 메모리는 안 건드려 — 우린 텍스트만 받아와. 응답을 파싱해 프롬프트를 뽑은 다음, free_vram_after가 켜져 있으면 cleanup_vram()으로 '디퓨전' 모델을 비워서 바로 뒤 i2i 단계에 자리를 내줘. 중간 노드라 OUTPUT_NODE가 아니고 STRING 하나만 반환해.",
    imports: [
      {
        name: "requests",
        what: "파이썬 HTTP 클라이언트 라이브러리",
        use: "post()로 llama.cpp 서버의 /v1/chat/completions를 호출해 프롬프트 텍스트를 받음",
      },
    ],
    diagram: {
      title: "프롬프트 생성 → VRAM 양보 흐름",
      kind: "architecture",
      summary: `flowchart LR
  N["LlamaCppPrompt 노드<br/>(ComfyUI 프로세스)"] -->|"requests.post (HTTP)"| L["llama.cpp 서버<br/>(별도 프로세스 · LLM VRAM 보유)"]
  L -->|"생성 텍스트 응답"| N
  N --> CU["cleanup_vram()<br/>디퓨전 모델만 언로드"]
  CU --> K["다음 단계: KSampler i2i<br/>(VRAM 풀로 사용)"]`,
    },
    lines: {
      24: "IS_CHANGED가 NaN을 반환 → 캐시 무효화. NaN은 자기 자신과도 같지 않아서 매 큐마다 LLM을 새로 호출.",
      28: "requests.post: llama.cpp 서버를 HTTP로 호출. LLM VRAM은 서버 몫이라 Comfy 메모리는 그대로.",
      38: "응답 JSON에서 생성된 프롬프트 텍스트만 추출(OpenAI 호환 choices[0].message.content).",
      41: "cleanup_vram(): LLM이 끝났으니 '디퓨전' 모델을 언로드 — 곧 올 i2i 단계에 VRAM을 양보. llama 서버는 안 내림(딴 프로세스).",
    },
  },
];

export default explanations;
