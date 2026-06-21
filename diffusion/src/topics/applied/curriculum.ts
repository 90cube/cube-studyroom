import type { Part } from "@/models/curriculum";
import { HF_DOCS_URL } from "@/data/constants";

// "응용" 토픽 — diffusers 다음 단계. 파이프라인을 부품으로 분해·교체하고,
// LCM·Lightning·Turbo 같은 가속(증류) 기법이 무엇을 변환하는지 본다.
// 사실 근거는 레포 루트 RESEARCH-NOTES-applied.md.

export const CURRICULUM: Part[] = [
  {
    id: 1,
    slug: "pipeline-parts",
    title: "Pipeline as Parts",
    titleKo: "파이프라인 = 부품 묶음",
    summary:
      "diffusers 파이프라인은 사실 부품(vae·text_encoder·tokenizer·unet·scheduler·safety_checker 등)을 한 객체에 묶어둔 것이다. 부품을 `pipe.unet`·`pipe.scheduler`처럼 꺼내 보고, 생성자 재조립이나 `from_pipe`로 일부만 갈아끼우는 법, `AutoPipeline`으로 태스크에 맞는 파이프라인을 자동 선택하는 법을 익힌다.",
    concepts: ["파이프라인 부품(components)", "부품 접근/교체", "from_pipe (부품 재사용)", "AutoPipeline", "재조립"],
    notebooks: [{ id: "a1-pipeline-parts", label: "내용" }],
    videos: [{ title: "HF 문서: Load pipelines & components", url: `${HF_DOCS_URL}/using-diffusers/loading` }],
    overview: {
      hook: "diffusers 파이프라인은 통짜 마법상자가 아니야 — vae·text encoder·unet·scheduler가 한 객체에 꽂혀 있는 '부품 묶음'일 뿐이야. 부품을 알면 하나씩 빼서 갈아끼울 수 있어.",
      oneLine: "StableDiffusionPipeline = vae + text_encoder + tokenizer + unet + scheduler + … 의 묶음. 부품을 속성으로 꺼내고, 생성자·from_pipe로 교체한다.",
      prereqs: [],
      unlocks: "부품 교체를 알면, Part 2에서 샘플러를, Part 3~4에서 unet/LoRA(가속 증류)를 같은 방식으로 갈아끼울 수 있다.",
      bigPicture: `flowchart LR
  P["StableDiffusionPipeline"] --> A["text_encoder + tokenizer"]
  P --> B["unet"]
  P --> C["vae"]
  P --> D["scheduler"]
  A -. "부품 교체" .-> P
  B -. "부품 교체" .-> P
  D -. "부품 교체" .-> P`,
    },
  },
  {
    id: 2,
    slug: "samplers",
    title: "Swapping Samplers",
    titleKo: "샘플러 갈아끼우기",
    summary:
      "같은 모델에 스케줄러(샘플러)만 교체하면 속도·품질이 달라진다. Euler·DPM++·DDIM·UniPC 등을 `from_config`로 끼우고, `timestep_spacing` 같은 설정으로 미세 조정하는 법을 본다. 모델 가중치는 그대로, '역확산을 어떻게 밟을지'만 바뀐다.",
    concepts: ["scheduler 교체", "from_config", "Euler/DPM++/DDIM/UniPC", "timestep_spacing", "compatibles"],
    notebooks: [{ id: "a2-samplers", label: "내용" }],
    videos: [{ title: "HF 문서: Schedulers", url: `${HF_DOCS_URL}/using-diffusers/schedulers` }],
    overview: {
      hook: "같은 모델, 다른 샘플러 — Euler·DPM++·DDIM·UniPC. 스케줄러 부품만 바꿔도 더 적은 스텝으로 더 깔끔하게 나오기도 해.",
      oneLine: "scheduler 부품을 from_config로 갈아끼워 역확산 알고리즘만 교체한다. timestep_spacing 등으로 다듬는다.",
      prereqs: [1],
      unlocks: "샘플러 교체가 익으면, Part 3의 LCMScheduler 같은 '가속 전용 샘플러'도 똑같은 방식으로 끼운다.",
      bigPicture: `flowchart LR
  M["고정된 모델(unet·vae)"] --> S{"scheduler 선택"}
  S --> E["Euler / DPM++"]
  S --> D["DDIM / UniPC"]
  E --> O["같은 모델, 다른 속도·품질"]
  D --> O`,
    },
  },
  {
    id: 3,
    slug: "lcm",
    title: "Distillation & LCM",
    titleKo: "증류 입문 & LCM",
    summary:
      "50스텝이 4스텝이 되는 건 마법이 아니라 증류(distillation)다 — 느린 teacher 모델의 결과를 빠른 student가 흉내내게 학습시킨다. 첫 주자 LCM(Latent Consistency Model)은 consistency distillation으로, Probability Flow ODE의 어느 점에서든 해답으로 직행하도록 배운다. LCM-LoRA로 만들면 어떤 SD에든 끼우는 범용 가속 모듈이 된다(LCMScheduler, ~4스텝, guidance 낮게).",
    concepts: ["증류 (teacher→student)", "consistency distillation", "Probability Flow ODE", "LCM-LoRA (범용)", "LCMScheduler / 4스텝"],
    notebooks: [{ id: "a3-lcm", label: "내용" }],
    videos: [{ title: "HF 블로그: SDXL in 4 steps with LCM-LoRA", url: "https://huggingface.co/blog/lcm_lora" }],
    overview: {
      hook: "50스텝이 4스텝 되는 게 마법 같지? 마법 아니야 — '증류(distillation)'야. 느린 선생(teacher)의 답을 빠른 학생(student)이 흉내내게 가르치는 거지. 첫 주자가 LCM.",
      oneLine: "증류 = 많은 스텝 모델을 적은 스텝 모델로 변환. LCM은 consistency distillation(ODE의 어느 점이든 해답으로 직행)으로 만들고, LCM-LoRA로 어떤 SD에든 끼운다.",
      prereqs: [1, 2],
      unlocks: "증류의 큰 그림을 잡았으니, Part 4에서 Lightning·Turbo가 '다른 방식으로' 같은 변환을 어떻게 하는지 비교한다.",
      bigPicture: `flowchart LR
  T["teacher: 느린 SD<br/>(수십 스텝)"] -->|"consistency distillation"| S["student: LCM<br/>(~4 스텝)"]
  S --> L["LCM-LoRA로 패키징"]
  L -->|"load_lora_weights"| ANY["아무 SD 베이스에 끼움"]`,
    },
  },
  {
    id: 4,
    slug: "distill-zoo",
    title: "Distillation Zoo",
    titleKo: "증류 동물원 — Lightning · Turbo",
    summary:
      "LCM 말고도 빠른 모델이 많다 — SDXL-Lightning, SDXL-Turbo, Hyper-SD. 모두 '느린 걸 빠르게' 증류하지만 방법이 다르다. **LCM**=consistency, **SDXL-Lightning**=progressive+adversarial(판별자가 SDXL 자기 U-Net, 잠재공간), **SDXL-Turbo**=ADD(Adversarial Diffusion Distillation, 판별자가 DINOv2, 픽셀공간). 각 방식이 무엇을 어떻게 변환하는지 한 판에 비교하고 적용법을 정리한다.",
    concepts: ["SDXL-Lightning (progressive+adversarial)", "SDXL-Turbo (ADD)", "판별자(discriminator) 차이", "Hyper-SD", "기법별 적용/스텝/guidance"],
    notebooks: [{ id: "a4-distill-zoo", label: "내용" }],
    videos: [
      { title: "논문: SDXL-Lightning (2402.13929)", url: "https://arxiv.org/abs/2402.13929" },
      { title: "비교: few-step image generation", url: "https://www.baseten.co/blog/comparing-few-step-image-generation-models/" },
    ],
    overview: {
      hook: "LCM 말고도 빠른 애들이 많아 — Lightning, Turbo, Hyper-SD. 다 '느린 걸 빠르게'인데, 변환하는 '방법'이 달라. 뭘 어떻게 증류하는지 한 판에 비교하자.",
      oneLine: "LCM=consistency, SDXL-Lightning=progressive+adversarial(SDXL U-Net 판별자), SDXL-Turbo=ADD(DINOv2 픽셀 판별자). 셋 다 teacher→few-step student 증류지만 레시피·판별자가 다르다.",
      prereqs: [3],
      unlocks: "각 방식의 차이를 알면, Part 5에서 가속 LoRA를 ControlNet·IP-Adapter 같은 다른 부품과 조합하는 실전 레시피로 간다.",
      bigPicture: `flowchart TD
  Z["느린 SD를 빠르게 (증류)"] --> A["LCM<br/>consistency (ODE 직행)"]
  Z --> B["SDXL-Lightning<br/>progressive + adversarial<br/>(판별자 = SDXL U-Net)"]
  Z --> C["SDXL-Turbo<br/>ADD (adversarial)<br/>(판별자 = DINOv2, 픽셀)"]`,
    },
  },
  {
    id: 5,
    slug: "swap-recipes",
    title: "Swap Recipes",
    titleKo: "부품 교체 응용 레시피",
    summary:
      "이제 다 갈아끼울 수 있으니, 실전에선 부품을 조합한다. 검증된 레시피: VAE 교체(예: `madebyollin/sdxl-vae-fp16-fix`로 fp16 NaN 회피), 가속 LoRA + ControlNet/IP-Adapter 동시 적용, `from_pipe`로 재로딩 없이 파이프라인 변형. 부품 교체 지식을 실전 워크플로우로 묶는다.",
    concepts: ["VAE 교체 (fp16-fix)", "가속 LoRA + ControlNet 조합", "IP-Adapter 결합", "from_pipe 변형", "실전 레시피"],
    notebooks: [{ id: "a5-swap-recipes", label: "내용" }],
    videos: [{ title: "HF 문서: Load community pipelines & components", url: `${HF_DOCS_URL}/using-diffusers/loading` }],
    overview: {
      hook: "이제 다 갈아끼울 수 있지? 실전에선 부품을 '조합'해 — fp16 VAE + 가속 LoRA + ControlNet 같은 레시피로.",
      oneLine: "검증된 조합: VAE 교체(fp16-fix), 가속 LoRA + ControlNet/IP-Adapter 동시 적용, from_pipe로 재로딩 없이 파이프라인 변형.",
      prereqs: [1, 4],
      unlocks: "여기까지면 파이프라인을 자유자재로 분해·교체·가속·조합할 수 있다 — 디퓨전 원리부터 실전 응용까지 완주.",
      bigPicture: `flowchart LR
  V["fp16-fix VAE"] --> R["조합 레시피"]
  A["가속 LoRA (LCM/Lightning)"] --> R
  C["ControlNet / IP-Adapter"] --> R
  R --> O["빠르고·제어되고·안정적인 생성"]`,
    },
  },
];

export const PART_BY_SLUG: Record<string, Part> = Object.fromEntries(
  CURRICULUM.map((p) => [p.slug, p]),
);
