import type { Part } from "@/models/curriculum";
import { HF_DOCS_URL } from "@/data/constants";

const GH = "https://github.com/huggingface/diffusers/blob/main/src/diffusers";

// diffusers 라이브러리 학습 경로. 각 파트는 핵심 소스를 골라 읽고(내부 동작) +
// 실제로 쓰는 법(사용법)을 같이 다룬다. 한국어 요약은 여기서 직접 작성한다.

export const CURRICULUM: Part[] = [
  {
    id: 1,
    slug: "pipeline-overview",
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
