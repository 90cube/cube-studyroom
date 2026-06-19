import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p8-optimization",
  title: "내용",
  cells: [
    {
      type: "markdown",
      source:
        "## 두 축으로 가볍게: 스텝 줄이기 + VRAM 줄이기\n추론 비용은 크게 둘이다 — (1) denoising **스텝 수**, (2) **VRAM** 점유. 스텝은 LCM 계열로 25~50 → 4~8까지 줄이고, VRAM은 attention slicing·VAE slicing·CPU offload·양자화로 누른다. 여기선 사용법 위주로 정리한다.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 1 — LCM-LoRA로 4스텝 추론\n가장 손쉬운 가속. 기존 SD/SDXL에 LCM-LoRA를 끼우고 스케줄러만 `LCMScheduler`로 바꾸면 4스텝으로 떨어진다. **핵심: `guidance_scale`을 0~2로 낮춰야 한다** — LCM은 CFG가 distillation에 녹아 있어 높은 CFG를 주면 깨진다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline, LCMScheduler

pipe = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    variant="fp16", torch_dtype=torch.float16,
).to("cuda")

# 1) LCM-LoRA 주입  2) 스케줄러를 LCM으로 교체
pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl")
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

image = pipe(
    "a close-up of a fox, autumn forest, bokeh",
    num_inference_steps=4,     # 25~50 -> 4
    guidance_scale=0.0,        # LCM-LoRA는 0~2로 낮게 (CFG가 내장됨)
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — LCM은 왜 4스텝이 되나 (`scheduling_lcm.py`)\nLCM은 매 스텝 노이즈를 조금씩 빼는 대신, **현재 노이즈에서 x₀(완성본)를 곧장 추정**하고 다음 시점만큼만 다시 노이즈를 더한다. 핵심은 `c_skip`·`c_out` 경계조건과 `predicted_original_sample`(x₀ 추정)이다. 그래서 큰 점프가 가능해 스텝이 확 준다.",
    },
    {
      type: "code",
      source: `# LCMScheduler.step 핵심 발췌
# 3. 경계조건 스케일 (consistency model)
c_skip, c_out = self.get_scalings_for_boundary_condition_discrete(timestep)

# 4. 모델 출력으로 x_0(완성본) 곧장 추정 (epsilon 예측 기준)
predicted_original_sample = (sample - beta_prod_t.sqrt() * model_output) / alpha_prod_t.sqrt()

# 6. 경계조건으로 denoise: x_0 와 현재 sample을 섞음
denoised = c_out * predicted_original_sample + c_skip * sample

# 7. 마지막 스텝이 아니면 다음 시점만큼 노이즈를 '다시' 주입 (멀티스텝)
if self.step_index != self.num_inference_steps - 1:
    noise = randn_tensor(model_output.shape, generator=generator, ...)
    prev_sample = alpha_prod_t_prev.sqrt() * denoised + beta_prod_t_prev.sqrt() * noise
else:
    prev_sample = denoised      # 마지막엔 완성본 그대로`,
    },
    {
      type: "code",
      source: `# get_scalings_for_boundary_condition_discrete — c_skip/c_out 정의
self.sigma_data = 0.5
scaled_timestep = timestep * self.config.timestep_scaling   # 기본 10.0

c_skip = self.sigma_data**2 / (scaled_timestep**2 + self.sigma_data**2)
c_out  = scaled_timestep / (scaled_timestep**2 + self.sigma_data**2) ** 0.5
# t가 클수록(노이즈 많음) c_out↑(x_0 추정 비중↑),
# t가 0에 가까우면 c_skip↑(현재 sample 유지) -> 경계에서 항등에 수렴`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 2 — VRAM 절감 스위치들\n슬라이싱·오프로딩은 한 줄씩 켜는 토글이다. `enable_attention_slicing`은 어텐션을 쪼개 계산(속도 약간 ↓, 메모리 ↓), `enable_vae_slicing/tiling`은 디코딩 메모리를 누른다. (참고: PyTorch 2.0 SDPA가 기본이라 최신 GPU에선 attention slicing 효과가 줄었다 — 메모리가 빠듯할 때만.)",
    },
    {
      type: "code",
      source: `# 메모리가 빠듯할 때 켜는 토글들
pipe.enable_attention_slicing()   # 어텐션을 쪼개 계산 (peak 메모리 ↓)
pipe.enable_vae_slicing()         # 배치 디코딩을 1장씩
pipe.enable_vae_tiling()          # 큰 해상도를 타일로 분할 디코딩

# 끄기
# pipe.disable_attention_slicing()`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 3 — CPU 오프로드 (작은 GPU에 큰 모델)\n모델 전체가 VRAM에 안 들어가면 안 쓰는 컴포넌트를 CPU로 내린다. `enable_model_cpu_offload`는 모델 단위로 옮겨 빠르고(권장), `enable_sequential_cpu_offload`는 서브모듈 단위라 더 절약되지만 훨씬 느리다. **주의: 호출 전에 `.to('cuda')` 하지 말 것** — 효과가 사라진다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16
)
# .to("cuda") 하지 않는다! 오프로드가 디바이스 이동을 관리함
pipe.enable_model_cpu_offload()    # 모델 단위 오프로드 (빠름, 권장)
# pipe.enable_sequential_cpu_offload()  # 서브모듈 단위 (더 절약, 매우 느림)

image = pipe("a lighthouse at dusk").images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 양자화로 거대 모델 욱여넣기 (`PipelineQuantizationConfig`)\nFlux(12B+)처럼 fp16으로도 24GB를 넘는 모델은 bitsandbytes 4bit/8bit 양자화로 가중치를 압축해 소비자 GPU에 올린다. `PipelineQuantizationConfig`에 백엔드와 비트수를 주면 로드 시 자동 양자화된다. **LCM 4스텝 + 4bit 양자화 + model offload**를 합치면, 빠르고·작고·돌아가는 실서비스 구성이 된다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline
from diffusers.quantizers import PipelineQuantizationConfig

# bitsandbytes 4bit 로 transformer/text_encoder 양자화
quant = PipelineQuantizationConfig(
    quant_backend="bitsandbytes_4bit",
    quant_kwargs={"load_in_4bit": True, "bnb_4bit_compute_dtype": torch.bfloat16},
    components_to_quantize=["transformer", "text_encoder_2"],
)

pipe = DiffusionPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    quantization_config=quant,
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()        # 양자화 + 오프로드 조합
image = pipe("a serene alpine lake", num_inference_steps=4, guidance_scale=0.0).images[0]`,
    },
  ],
};

export default doc;
