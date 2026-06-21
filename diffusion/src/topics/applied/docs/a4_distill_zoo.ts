import type { StudyDoc } from "@/models/study";

// 사실 근거: RESEARCH-NOTES-applied.md (B. 가속 = 증류).
// LCM=consistency(PF-ODE 직행), SDXL-Lightning=progressive+adversarial(판별자=SDXL 자기 U-Net, 잠재공간),
// SDXL-Turbo=ADD(판별자=DINOv2, 픽셀공간), Hyper-SD=trajectory-segmented consistency + human feedback.
// 적용 패턴은 로컬 diffusers 소스로 확인: set_adapters / EulerDiscreteScheduler.from_config /
// UNet2DConditionModel.from_config + load_state_dict / LCMScheduler / TCDScheduler.

const doc: StudyDoc = {
  id: "a4-distill-zoo",
  title: "증류 동물원 — Lightning · Turbo",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 다 '느린→빠른' 증류인데, 변환하는 '레시피'가 다르다\nPart 3에서 LCM을 봤지? 빠른 모델은 LCM 말고도 많아 — **SDXL-Lightning**, **SDXL-Turbo**, **Hyper-SD**. 공통점은 하나: 수십 스텝짜리 teacher를 1~8 스텝 student로 **증류(distillation)**한다는 것. 차이는 *무엇을 기준으로 student를 다그치느냐* — 즉 **증류 기법**과 **판별자(discriminator)**가 다르다. 판별자 = '학생 그림이 진짜 같냐'를 채점하는 심사위원이야.\n\n핵심 한 줄: **LCM은 ODE 위 두 점이 같은 답을 내도록(consistency)**, **Lightning은 progressive로 스텝을 반씩 줄이며 adversarial로 다그치고(심사위원 = SDXL 자기 U-Net, 잠재공간)**, **Turbo는 ADD로 처음부터 적대 학습(심사위원 = DINOv2, 픽셀공간)**.",
    },
    {
      type: "markdown",
      source:
        "## 비교 — 무엇을 어떻게 변환하나 (한 판)\n| 기법 | 증류 방식 | 판별자(심사위원) | 판별 공간 | 스텝 | guidance | 적용 형태 |\n|------|-----------|------------------|-----------|------|----------|-----------|\n| **LCM / LCM-LoRA** | consistency distillation (PF-ODE 직행) | 없음 (판별자 안 씀) | — | 2~4(~1) | 낮게 (≈1) | LoRA 어댑터 + `LCMScheduler` |\n| **SDXL-Lightning** | progressive + **adversarial** | **SDXL 자기 U-Net** | **잠재(latent)** | 1·2·4·8 | **0** (끔) | LoRA 또는 풀 UNet + `EulerDiscreteScheduler` |\n| **SDXL-Turbo / SD-Turbo** | **ADD** (Adversarial Diffusion Distillation) | **DINOv2** | **픽셀(pixel)** | 1~4 | **0.0** (끔) | 전용 체크포인트(베이스 가중치로 init) |\n| **Hyper-SD** | trajectory-segmented consistency + human feedback | (단계별) | — | 1~8 | 낮게 | LoRA + `TCDScheduler`(또는 `LCMScheduler`) |\n\n읽는 법: **판별자 열이 Lightning vs Turbo를 가르는 핵심**이야. 둘 다 'adversarial(적대적)'인데, Lightning은 *잠재공간에서 SD 자기 U-Net*을 심사위원으로 쓰고, Turbo는 *픽셀공간에서 DINOv2*(자기지도 비전 모델)를 심사위원으로 쓴다. LCM은 아예 심사위원 없이 'ODE 위에서 답이 일관되게' 만으로 증류해.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 ① — LCM-LoRA: 어떤 SDXL에든 끼우는 범용 가속\nLCM은 LoRA 어댑터로 패키징돼서 베이스 모델을 안 가린다. 끼우는 순서는 딱 둘: (1) `load_lora_weights`로 LCM-LoRA를 얹고, (2) 스케줄러를 `LCMScheduler`로 바꾼다. 추론은 `num_inference_steps≈4`, `guidance_scale`은 낮게(1~2). 일반 SDXL은 guidance 7쯤 쓰지만 증류 모델은 낮춰야 깨지지 않아.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, LCMScheduler

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

# (1) LCM-LoRA 어댑터를 얹는다 (범용 가속 모듈, ~100MB)
pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl")

# (2) 스케줄러를 LCM 전용으로 교체 — config는 물려받고 알고리즘만 LCM
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

image = pipe(
    "a self-portrait of a red panda, oil painting",
    num_inference_steps=4,      # 50 -> 4
    guidance_scale=1.0,         # 증류 모델은 guidance 낮게
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 ② — SDXL-Lightning: progressive+adversarial UNet 끼우기\nLightning은 1·2·4·8 스텝 체크포인트가 있고, LoRA 형태와 **풀 UNet** 형태 둘 다 배포돼. 풀 UNet을 쓸 땐 베이스의 빈 UNet 골격(`from_config`)에 Lightning 가중치(`load_state_dict`)를 부어 넣어. 포인트 두 개: **`guidance_scale=0`**(Lightning은 CFG를 끔), 그리고 스케줄러를 `EulerDiscreteScheduler` + **`timestep_spacing=\"trailing\"`**으로 둔다 — 적은 스텝에서 마지막 타임스텝을 정확히 밟게 하는 설정이야.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionXLPipeline, UNet2DConditionModel, EulerDiscreteScheduler
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file

base = "stabilityai/stable-diffusion-xl-base-1.0"
repo = "ByteDance/SDXL-Lightning"
ckpt = "sdxl_lightning_4step_unet.safetensors"   # 4-step 풀 UNet

# (1) 베이스 UNet 골격만 만들고 Lightning 가중치를 부어 넣는다
unet = UNet2DConditionModel.from_config(base, subfolder="unet").to("cuda", torch.float16)
unet.load_state_dict(load_file(hf_hub_download(repo, ckpt), device="cuda"))

pipe = StableDiffusionXLPipeline.from_pretrained(
    base, unet=unet, torch_dtype=torch.float16, variant="fp16",
).to("cuda")

# (2) Euler + trailing 간격: 소수 스텝에서 끝 타임스텝까지 정확히 밟기
pipe.scheduler = EulerDiscreteScheduler.from_config(
    pipe.scheduler.config, timestep_spacing="trailing",
)

image = pipe(
    "a cinematic photo of an owl, golden hour",
    num_inference_steps=4,
    guidance_scale=0,           # Lightning은 CFG 끔
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 ③ — SDXL-Turbo: ADD 전용 체크포인트\nTurbo는 LoRA가 아니라 **전용 모델**이야 — student를 베이스 가중치로 초기화한 뒤 ADD로 다시 학습한 결과를, 통째로 불러와. 1~4 스텝, **`guidance_scale=0.0`**(역시 CFG 끔). 1스텝일 땐 `num_inference_steps=1`만으로 끝나서 거의 실시간이야.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image

# Turbo는 전용 체크포인트를 통째로 로드 (LoRA 아님)
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

image = pipe(
    "a close-up of a fox in snow, sharp focus",
    num_inference_steps=1,      # 1스텝이면 거의 실시간
    guidance_scale=0.0,         # ADD 모델은 CFG 끔
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — Hyper-SD, 그리고 '뭘 골라 쓰나'\n**Hyper-SD**(ByteDance)는 trajectory-segmented consistency distillation에 human feedback을 더한 1~8 스텝 LoRA야. 끼우는 법은 LCM과 거의 같되 스케줄러를 **`TCDScheduler`**(또는 `LCMScheduler`)로 둬. 선택 기준 한 줄: **품질·호환 우선이면 LCM-LoRA/Hyper-SD(LoRA라 베이스 자유)**, **1024² 고품질 소수 스텝이면 SDXL-Lightning**, **최저 지연(1스텝 실시간)이면 SDXL-Turbo**. 전부 'teacher→few-step student' 증류라는 점은 같고, *판별자·기법*만 다르다는 게 핵심.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, TCDScheduler
from huggingface_hub import hf_hub_download

base = "stabilityai/stable-diffusion-xl-base-1.0"
repo = "ByteDance/Hyper-SD"
ckpt = "Hyper-SDXL-1step-lora.safetensors"

pipe = AutoPipelineForText2Image.from_pretrained(
    base, torch_dtype=torch.float16, variant="fp16",
).to("cuda")

# Hyper-SD LoRA를 얹고 TCD 스케줄러로 교체
pipe.load_lora_weights(hf_hub_download(repo, ckpt))
pipe.fuse_lora()
pipe.scheduler = TCDScheduler.from_config(pipe.scheduler.config)

# 1-step LoRA는 eta 로 디테일을 조절 (TCD 특성)
image = pipe(
    "a watercolor hummingbird",
    num_inference_steps=1,
    guidance_scale=0,
    eta=1.0,
).images[0]`,
    },
  ],
};

export default doc;
