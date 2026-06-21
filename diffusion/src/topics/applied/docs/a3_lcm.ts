import type { StudyDoc } from "@/models/study";

// 소스 근거: diffusers/src/diffusers/schedulers/scheduling_lcm.py (LCMScheduler, step의 c_skip/c_out 경계조건),
// load_lora_weights (LoRA loader). RESEARCH-NOTES-applied.md B절 (LCM / LCM-LoRA).

const doc: StudyDoc = {
  id: "a3-lcm",
  title: "증류 입문 & LCM",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 50스텝이 4스텝 되는 건 증류(distillation)다\n마법이 아니라 **증류**야. 느린 **teacher**(수십 스텝짜리 잘 학습된 SD)의 출력 분포를, 빠른 **student**(같은 분포를 1~8스텝으로 푸는 모델)가 흉내내도록 다시 학습시키는 거야. '무엇을 변환?' = 데이터 분포는 그대로 두고 **모델 가중치**를, 적은 스텝으로도 같은 그림에 도달하도록 옮겨. 추론 코드가 빨라지는 게 아니라 모델 자체가 적은-스텝용으로 바뀐 거야.",
    },
    {
      type: "markdown",
      source:
        "## 개념 — LCM = consistency distillation (ODE 직행)\n첫 주자가 **LCM(Latent Consistency Model)**이야. teacher(guided diffusion)를 잠재공간에서 **consistency distillation**으로 증류해 — 핵심은 *consistency*: 역확산 궤적(augmented Probability Flow ODE)의 **어느 점에서 출발하든 곧장 해답(x_0)으로 직행**하도록 배운다. 그래서 한 스텝이 멀리 점프할 수 있고 2~4스텝(심지어 1스텝)이면 끝나. 전용 부품이 `LCMScheduler`야.",
    },
    {
      type: "markdown",
      source:
        "## 동작 — LCMScheduler.step: 경계조건으로 x_0 직행\nLCM의 한 스텝이 '직행'을 어떻게 구현하는지 실제 소스로 보자. (1) U-Net 출력으로 '예측 x_0'을 만들고, (2) consistency **경계조건** 계수 `c_skip` · `c_out`으로 `denoised = c_out·x_0 + c_skip·sample` 을 만들어 — 이게 'ODE 해답으로 바로 끌어당기는' 부분이야. (3) 마지막 스텝이 아니면 다음 노이즈 레벨로 살짝 되-노이즈(multi-step), 마지막 스텝이면 노이즈 없이 `denoised` 그대로 내보내.",
    },
    {
      type: "code",
      source: `# scheduling_lcm.py — LCMScheduler.step (핵심 발췌)
# 4. "예측된 깨끗한 원본 x_0" 만들기 (prediction_type == "epsilon")
predicted_original_sample = (sample - beta_prod_t.sqrt() * model_output) / alpha_prod_t.sqrt()

# 5. 수치 안정용 clip
if self.config.clip_sample:
    predicted_original_sample = predicted_original_sample.clamp(
        -self.config.clip_sample_range, self.config.clip_sample_range
    )

# 6. consistency 경계조건 c_skip / c_out 으로 해답(x_0)으로 '직행'
denoised = c_out * predicted_original_sample + c_skip * sample

# 7. 마지막 스텝이 아니면 다음 레벨로 노이즈 주입(multi-step), 마지막이면 denoised 그대로
if self.step_index != self.num_inference_steps - 1:
    noise = randn_tensor(model_output.shape, generator=generator,
                         device=model_output.device, dtype=denoised.dtype)
    prev_sample = alpha_prod_t_prev.sqrt() * denoised + beta_prod_t_prev.sqrt() * noise
else:
    prev_sample = denoised`,
    },
    {
      type: "markdown",
      source:
        "## 동작 — 네이티브 LCM 모델 추론\nLCM으로 증류된 체크포인트는 `LCMScheduler`를 끼우고 **적은 스텝 + 낮은 guidance**로 호출해. LCM은 guidance를 학습에 녹여놔서 추론 때 `guidance_scale`을 낮게(보통 0~2) 둬야 색이 안 타. `num_inference_steps≈4`가 표준이야.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline, LCMScheduler

# LCM 으로 증류된 student 체크포인트
pipe = DiffusionPipeline.from_pretrained(
    "SimianLuo/LCM_Dreamshaper_v7",
    torch_dtype=torch.float16,
).to("cuda")

# 전용 스케줄러로 교체 (config 는 물려받음)
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

image = pipe(
    "a portrait of an astronaut, cinematic lighting",
    num_inference_steps=4,     # 2~4 스텝이 표준
    guidance_scale=1.0,        # LCM 은 guidance 를 낮게 (보통 0~2)
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — LCM-LoRA: 어떤 SD에든 끼우는 범용 가속 모듈\n진짜 실용 포인트는 **LCM-LoRA**야. LCM 증류를 베이스 모델에 굽지 않고 **LoRA 어댑터(~100MB)**로 떼어내, 같은 베이스 계열(SD1.5 / SDXL)이면 **학습 없이 끼우기만** 하면 적은-스텝 가속이 붙어. 레시피는 늘 같아: `load_lora_weights(lcm_lora_repo)` + scheduler를 `LCMScheduler`로 + `num_inference_steps≈4` + `guidance_scale` 낮게.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, LCMScheduler

# 아무 SDXL 베이스 모델
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

# (1) 스케줄러를 LCM 으로  (2) LCM-LoRA 어댑터를 끼운다 (학습 없음)
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl")

image = pipe(
    "a cozy cabin in the woods, golden hour",
    num_inference_steps=4,     # ~4 스텝
    guidance_scale=1.0,        # 낮은 guidance
).images[0]`,
    },
  ],
};

export default doc;
