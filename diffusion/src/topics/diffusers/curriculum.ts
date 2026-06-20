import type { Part } from "@/models/curriculum";
import { HF_DOCS_URL } from "@/data/constants";

const GH = "https://github.com/huggingface/diffusers/blob/main/src/diffusers";

// diffusers 라이브러리 학습 경로. 각 파트는 핵심 소스를 골라 읽고(내부 동작) +
// 실제로 쓰는 법(사용법)을 같이 다룬다. 한국어 요약은 여기서 직접 작성한다.

export const CURRICULUM: Part[] = [
  {
    id: 1,
    slug: "pipeline-overview",
    overview: {
      hook: "라이브러리를 부품부터 파면 길을 잃어 — 먼저 위에서 내려다보자. 프롬프트 한 줄이 이미지가 되기까지 `pipe()` 안에서 무슨 일이 벌어지는지, 그 한 바퀴를 먼저 돈다. 그래야 나머지 7파트가 '이 지도의 어디'인지 보인다.",
      oneLine: "`StableDiffusionPipeline.__call__`을 따라가며 텍스트 인코딩(CLIP) → latent 준비 → U-Net 디노이징 루프(+CFG) → VAE 디코딩의 전 과정을 한눈에 잡는다.",
      prereqs: [],
      unlocks: "이 파이프라인이 전체 지도 — 스케줄러(2)·U-Net(3)·어텐션(4)·VAE(5)가 각각 어느 칸에 끼는지 알게 돼, 이후 파트를 '부품 줌인'으로 읽을 수 있다.",
      bigPicture: `flowchart LR
  P["프롬프트"] -->|"encode_prompt (CLIP)"| E["텍스트 임베딩"]
  E --> L["U-Net 디노이징 루프<br/>(scheduler.step · CFG)"]
  Z["랜덤 latent"] --> L
  L -->|"vae.decode"| I["🖼 이미지"]`,
    },
    title: "Pipeline Walkthrough",
    titleKo: "파이프라인 한 바퀴",
    summary:
      "`StableDiffusionPipeline`이 프롬프트 한 줄을 이미지로 바꾸기까지의 전 과정을 본다. **사용법**(`from_pretrained`으로 불러와 `pipe(prompt)` 호출)부터, **내부 동작**(`__call__` 안에서 텍스트 인코딩(CLIP) → latent 준비 → U-Net denoising 루프(+classifier-free guidance) → VAE 디코딩)까지. 나머지 파트(스케줄러·U-Net·VAE·어텐션)가 여기 어디에 끼는지 지도를 먼저 그린다.",
    concepts: [
      "from_pretrained / pipe(prompt)",
      "encode_prompt (CLIP)",
      "denoising 루프",
      "classifier-free guidance",
      "scheduler.step / vae.decode",
    ],
    notebooks: [
      { id: "p1-usage", label: "사용법" },
      { id: "p1-internals", label: "내부 동작" },
    ],
    videos: [
      { title: "소스: pipeline_stable_diffusion.py", url: `${GH}/pipelines/stable_diffusion/pipeline_stable_diffusion.py` },
      { title: "HF 문서: text-to-image", url: `${HF_DOCS_URL}/using-diffusers/conditional_image_generation` },
    ],
  },
  {
    id: 2,
    slug: "scheduler",
    overview: {
      hook: "파이프라인 루프에서 'x_t를 한 칸 디노이즈'하던 그 `scheduler.step`, 그 안이 궁금했지? 노이즈를 언제 얼마나 넣고 빼는지를 정하는 게 스케줄러야. 같은 모델에 샘플러만 갈아끼우면 속도·품질이 바뀌는 비밀이 여기 있다.",
      oneLine: "`betas`/`alphas_cumprod`로 노이즈 일정을 정의하고, `add_noise`(주입)와 `step`(x_t→x_{t-1} 한 칸 역확산)로 디노이징을 한 칸씩 굴리는 부품.",
      prereqs: [1],
      unlocks: "샘플러를 교체할 수 있게 돼(DDPM↔DDIM↔LCM) — 적은 스텝으로 빠르게 뽑는 추론 최적화(8)의 토대가 된다.",
      bigPicture: `flowchart LR
  X["x_t (현재 latent)"] --> S{"scheduler.step"}
  N["U-Net의 노이즈 예측 ε"] --> S
  B["betas · alphas_cumprod<br/>(노이즈 일정)"] --> S
  S -->|"한 칸 역확산"| X2["x_{t-1}"]`,
    },
    title: "Schedulers",
    titleKo: "스케줄러",
    summary:
      "노이즈 일정과 '한 스텝 역확산'을 책임지는 부품. `DDPMScheduler`·`DDIMScheduler`의 **add_noise**(학습용으로 깨끗한 latent에 노이즈 주입)와 **step**(`x_t → x_{t-1}` 한 칸 디노이즈)을 읽는다. `betas`/`alphas_cumprod`가 어떻게 정의되고, 같은 모델에 샘플러만 바꿔 끼우는 게 왜 가능한지 이해한다.",
    concepts: ["betas / alphas_cumprod", "add_noise", "step (x_t→x_t-1)", "DDPM vs DDIM", "샘플러 교체"],
    notebooks: [{ id: "p2-scheduler", label: "내용" }],
    videos: [{ title: "소스: scheduling_ddpm.py", url: `${GH}/schedulers/scheduling_ddpm.py` }],
  },
  {
    id: 3,
    slug: "unet",
    overview: {
      hook: "루프가 매 스텝 부르던 '노이즈를 맞히는 본체', 그게 U-Net이야. 스케줄러가 '얼마나 빼지'를 정한다면, U-Net은 '뭘 빼지'를 예측한다. 디퓨전 강의에서 짠 작은 U-Net이 실전에선 어떻게 커지는지 그 forward를 따라간다.",
      oneLine: "`UNet2DConditionModel.forward`에서 timestep 임베딩 + down/mid/up 블록(ResNet+attention)으로 노이즈를 예측하고, 텍스트(`encoder_hidden_states`)가 cross-attention으로 주입된다.",
      prereqs: [1],
      unlocks: "노이즈 예측 본체의 구조를 알게 돼 — 텍스트가 들어오는 cross-attention 지점(4), residual이 더해지는 ControlNet 결합점(6)을 정확히 짚을 수 있다.",
      bigPicture: `flowchart LR
  X["noisy latent x_t"] --> U["U-Net forward"]
  T["timestep 임베딩"] --> U
  C["텍스트 임베딩<br/>(encoder_hidden_states)"] -->|"cross-attention 주입"| U
  U --> EPS["예측 노이즈 ε"]`,
    },
    title: "UNet2DConditionModel",
    titleKo: "U-Net",
    summary:
      "노이즈를 예측하는 본체. `UNet2DConditionModel.forward`에서 timestep 임베딩, down/mid/up 블록(ResNet+attention), 그리고 텍스트(`encoder_hidden_states`)가 **cross-attention**으로 주입되는 지점을 따라간다. 디퓨전 강의에서 만든 작은 U-Net이 실전에선 어떻게 커지는지.",
    concepts: ["timestep embedding", "down/mid/up 블록", "ResNet + attention", "encoder_hidden_states", "cross-attention 주입"],
    notebooks: [{ id: "p3-unet", label: "내용" }],
    videos: [{ title: "소스: unet_2d_condition.py", url: `${GH}/models/unets/unet_2d_condition.py` }],
  },
  {
    id: 4,
    slug: "attention",
    overview: {
      hook: "U-Net 안에서 텍스트가 그림을 '조종'하던 그 cross-attention, 이제 그 계산 자체를 연다. Q·K·V가 어떻게 픽셀과 단어를 잇는지 보고 나면, `AttnProcessor` 하나만 갈아끼워 IP-Adapter 같은 확장이 왜 가능한지 자연히 보인다.",
      oneLine: "`attention_processor`의 self/cross-attention(Q·K·V) 계산을 읽고, `AttnProcessor`를 교체하는 것만으로 어텐션 동작을 갈아끼우는 확장점을 파악한다.",
      prereqs: [3],
      unlocks: "어텐션이 곧 '조종대'이자 '확장 콘센트'임을 알게 돼 — 이미지 임베딩을 별도 cross-attention으로 더하는 IP-Adapter 등 어댑터 로딩(7)의 동작 원리가 열린다.",
      bigPicture: `flowchart LR
  Q["Q (이미지 latent)"] --> A["attention<br/>softmax(QKᵀ)·V"]
  K["K (텍스트 임베딩)"] --> A
  V["V (텍스트 임베딩)"] --> A
  A --> O["조건화된 특징"]
  A -.->|"AttnProcessor 교체"| X["IP-Adapter 등 확장"]`,
    },
    title: "Attention & Conditioning",
    titleKo: "어텐션 · 조건화",
    summary:
      "텍스트가 이미지 생성을 어떻게 '조종'하는지의 핵심. `attention_processor`의 self/cross-attention 계산을 읽고, `AttnProcessor`를 교체하는 것만으로 IP-Adapter 같은 확장이 어떻게 가능한지 본다.",
    concepts: ["self vs cross attention", "Q·K·V", "AttnProcessor 교체", "텍스트 임베딩 주입", "IP-Adapter 확장점"],
    notebooks: [{ id: "p4-attention", label: "내용" }],
    videos: [{ title: "소스: attention_processor.py", url: `${GH}/models/attention_processor.py` }],
  },
  {
    id: 5,
    slug: "vae",
    overview: {
      hook: "파이프라인 입구와 출구에 조용히 서 있던 변환기 — 그게 VAE야. 디퓨전이 무거운 픽셀이 아니라 작은 latent에서 돌아갈 수 있는 건 다 얘 덕분이다. SD가 큰 해상도를 감당하는 비결을 여기서 본다.",
      oneLine: "`AutoencoderKL.encode`/`decode`로 이미지↔latent를 오가고, `scaling_factor`로 latent 분포를 맞춰 잠재 공간 디퓨전을 싸게 만든다.",
      prereqs: [1],
      unlocks: "왜 디퓨전이 잠재 공간에서 도는지, 루프 마지막 `vae.decode`가 무엇을 되돌리는지 이해해 — 파이프라인 한 바퀴(1)의 입·출구가 비로소 닫힌다.",
      bigPicture: `flowchart LR
  I["🖼 이미지 (픽셀)"] -->|"encode"| Z["latent (저차원)"]
  Z -->|"여기서 디퓨전<br/>(싸다)"| Z2["디노이즈된 latent"]
  Z2 -->|"decode"| O["🖼 복원 이미지"]`,
    },
    title: "AutoencoderKL (VAE)",
    titleKo: "VAE",
    summary:
      "이미지 ↔ latent 변환기. `AutoencoderKL.encode`/`decode`를 읽고, 왜 잠재공간에서 디퓨전하면 훨씬 싼지, `scaling_factor`가 왜 필요한지 이해한다. SD가 고해상도를 감당하는 비결.",
    concepts: ["encode / decode", "latent 분포", "scaling_factor", "압축률", "픽셀↔잠재 공간"],
    notebooks: [{ id: "p5-vae", label: "내용" }],
    videos: [{ title: "소스: autoencoder_kl.py", url: `${GH}/models/autoencoders/autoencoder_kl.py` }],
  },
  {
    id: 6,
    slug: "controlnet",
    overview: {
      hook: "텍스트만으론 '이 포즈, 이 윤곽 그대로'를 시키기 어려워. ControlNet은 U-Net을 건드리지 않고 곁가지를 하나 붙여, edge·pose·depth 같은 구조를 그림에 강제한다. U-Net 블록 구조(3)를 알면 이 곁가지가 어디에 끼는지 바로 보인다.",
      oneLine: "`ControlNetModel`이 conditioning image로 residual을 만들어 U-Net 블록 출력에 더하고(`conditioning_scale`로 세기 조절), 형태·포즈를 정밀 제어한다.",
      prereqs: [3],
      unlocks: "본체를 고정한 채 외부 신호를 주입하는 패턴을 익혀 — 같은 '끼워넣기' 사고가 어댑터 로딩(7)으로 이어진다. 여러 개를 동시에 거는 multi-controlnet도 가능.",
      bigPicture: `flowchart LR
  C["조건 이미지<br/>(edge · pose · depth)"] --> CN["ControlNetModel"]
  CN -->|"residual × conditioning_scale"| U["U-Net 블록 (고정)"]
  U --> O["구조가 제어된 생성"]`,
    },
    title: "ControlNet",
    titleKo: "ControlNet",
    summary:
      "구조적 조건(edge·pose·depth)을 U-Net에 주입하는 곁가지. `ControlNetModel`이 어떻게 residual을 만들어 U-Net 블록에 더해 형태를 제어하는지, 그리고 파이프라인에 결합해 쓰는 법을 본다.",
    concepts: ["conditioning image", "control residual", "U-Net 결합", "multi-controlnet", "conditioning scale"],
    notebooks: [{ id: "p6-controlnet", label: "내용" }],
    videos: [{ title: "HF 문서: ControlNet", url: `${HF_DOCS_URL}/using-diffusers/controlnet` }],
  },
  {
    id: 7,
    slug: "loaders",
    overview: {
      hook: "남이 만든 LoRA·IP-Adapter 파일 하나로 본체가 새 스타일을 입어. 그 'load_xxx' 한 줄이 내부적으로 어느 모듈에 무엇을 꽂는지 들여다본다. 어텐션(4)이 확장 콘센트였다는 걸 알면, 어댑터가 왜 거기에 붙는지 단번에 이해된다.",
      oneLine: "`load_lora_weights`·`load_ip_adapter` 같은 loader가 PEFT와 연동해 어텐션 등 특정 모듈에 가중치를 주입(fuse/unfuse)하는 메커니즘을 본다.",
      prereqs: [3, 4],
      unlocks: "본체를 통째로 재학습하지 않고 어댑터만 끼워 확장하는 법을 익혀 — 추론 최적화(8)의 LCM-LoRA처럼 '가벼운 주입'으로 동작을 바꾸는 응용으로 이어진다.",
      bigPicture: `flowchart LR
  F["어댑터 파일<br/>(LoRA · IP-Adapter · TI)"] --> LD["load_* (PEFT 연동)"]
  LD -->|"가중치 주입"| M["어텐션·U-Net 모듈"]
  M -->|"fuse / unfuse"| P["확장된 파이프라인"]`,
    },
    title: "Adapters & Loaders",
    titleKo: "어댑터 로딩",
    summary:
      "LoRA·textual inversion·IP-Adapter 가중치를 본체에 끼우는 메커니즘. `load_lora_weights` 같은 loader가 내부적으로 어떤 모듈에 무엇을 주입하는지, PEFT와 어떻게 연동되는지 본다.",
    concepts: ["load_lora_weights", "PEFT 연동", "textual inversion", "어댑터 fuse/unfuse", "가중치 주입 지점"],
    notebooks: [{ id: "p7-loaders", label: "내용" }],
    videos: [{ title: "HF 문서: LoRA 불러오기", url: `${HF_DOCS_URL}/using-diffusers/loading_adapters` }],
  },
  {
    id: 8,
    slug: "optimization",
    overview: {
      hook: "전부 이해했으면 마지막은 '실전에서 빠르고 가볍게'야. 수십 스텝을 4~8 스텝으로 줄이는 `LCMScheduler`(스케줄러를 갈아끼우는 그 트릭!)와, VRAM을 쥐어짜는 slicing·offload·양자화를 사용법 위주로 모은다.",
      oneLine: "`LCMScheduler`로 스텝 수를 4~8로 줄이고, attention slicing·CPU offload·양자화로 VRAM을 절감하는 추론 가속 기법 모음.",
      prereqs: [1, 2],
      unlocks: "속도↔품질↔메모리 트레이드오프를 직접 조절할 수 있게 돼 — 작은 GPU에서도 파이프라인(1)을 실용적으로 돌리는 마무리 단계.",
      bigPicture: `flowchart LR
  P["기본 파이프라인<br/>(수십 스텝)"] --> O{"최적화 선택"}
  O -->|"LCMScheduler"| F["4~8 스텝 (빠름)"]
  O -->|"slicing · offload · 양자화"| V["VRAM 절감"]`,
    },
    title: "Inference Optimization",
    titleKo: "추론 최적화",
    summary:
      "더 빠르고 가볍게 돌리는 법. `LCMScheduler`로 4~8 스텝 추론, 그리고 attention slicing·CPU offload·양자화 같은 VRAM 절감 테크닉을 사용법 위주로 정리한다.",
    concepts: ["LCMScheduler", "step 수 감소", "attention slicing", "CPU offload", "양자화 / VRAM 절감"],
    notebooks: [{ id: "p8-optimization", label: "내용" }],
    videos: [{ title: "HF 문서: 추론 속도", url: `${HF_DOCS_URL}/optimization/fp16` }],
  },
];

export const PART_BY_SLUG: Record<string, Part> = Object.fromEntries(
  CURRICULUM.map((p) => [p.slug, p]),
);
