import type { StudyDoc } from "@/models/study";

// 소스: diffusers/src/diffusers/schedulers/scheduling_ddpm.py, scheduling_ddim.py
// 핵심 메서드만 발췌 — __init__(betas/alphas_cumprod), add_noise, step (DDPM & DDIM).

const doc: StudyDoc = {
  id: "p2-scheduler",
  title: "스케줄러",
  cells: [
    {
      type: "markdown",
      source:
        "## 사용법 — 모델은 그대로, 샘플러만 갈아끼운다\n스케줄러는 **노이즈 일정**과 **한 스텝 역확산**(`x_t → x_{t-1}`)만 책임지는 부품이다. U-Net 가중치와 분리돼 있어서, 같은 파이프라인에 샘플러만 바꿔 끼울 수 있다. 핵심 관문은 `from_config` — 기존 스케줄러의 설정(`betas`·`num_train_timesteps` 등)을 그대로 물려받아 알고리즘만 교체한다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline, DDIMScheduler

pipe = DiffusionPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to("cuda")

# 어떤 스케줄러로 바꿀 수 있는지 본다 (호환 목록)
print(pipe.scheduler.compatibles)

# 설정은 물려받고 역확산 알고리즘만 DDIM으로 교체
pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)

image = pipe("a lighthouse on a cliff", num_inference_steps=25).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — 노이즈 일정(betas / alphas_cumprod)\n모든 게 여기서 시작한다. `betas`는 각 스텝에서 섞을 노이즈의 양이고, `alphas_cumprod`(ᾱ_t)는 그걸 0..t까지 누적 곱한 값 — \"t 시점에 원본이 얼마나 남아 있나\"를 한 숫자로 압축한 거다. `DDPMScheduler.__init__`의 실제 발췌.",
    },
    {
      type: "code",
      source: `# scheduling_ddpm.py — DDPMScheduler.__init__ (발췌)
if beta_schedule == "linear":
    self.betas = torch.linspace(beta_start, beta_end, num_train_timesteps, dtype=torch.float32)
elif beta_schedule == "scaled_linear":
    # latent diffusion(SD)에 특화된 일정
    self.betas = torch.linspace(
        beta_start**0.5, beta_end**0.5, num_train_timesteps, dtype=torch.float32
    ) ** 2
elif beta_schedule == "squaredcos_cap_v2":
    self.betas = betas_for_alpha_bar(num_train_timesteps)  # cosine 일정

self.alphas = 1.0 - self.betas
self.alphas_cumprod = torch.cumprod(self.alphas, dim=0)   # ᾱ_t = Π (1 − β)
self.one = torch.tensor(1.0)`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — add_noise (정방향, 학습 신호 만들기)\n학습할 때 쓴다. 깨끗한 원본 `x_0`에 노이즈 한 방에 섞어서 `x_t`를 만든다 — 그래야 U-Net한테 \"이 노이즈 맞혀봐\"라고 시킬 정답이 생긴다. 닫힌형 공식 `x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε` 그대로다(루프 없이 한 번에 점프). DDIM도 이 메서드를 그대로 복사해 쓴다.",
    },
    {
      type: "code",
      source: `# scheduling_ddpm.py — DDPMScheduler.add_noise (발췌)
def add_noise(self, original_samples, noise, timesteps):
    alphas_cumprod = self.alphas_cumprod.to(dtype=original_samples.dtype)
    timesteps = timesteps.to(original_samples.device)

    sqrt_alpha_prod = alphas_cumprod[timesteps] ** 0.5            # √ᾱ_t
    sqrt_alpha_prod = sqrt_alpha_prod.flatten()
    while len(sqrt_alpha_prod.shape) < len(original_samples.shape):
        sqrt_alpha_prod = sqrt_alpha_prod.unsqueeze(-1)          # 브로드캐스트 차원 맞추기

    sqrt_one_minus_alpha_prod = (1 - alphas_cumprod[timesteps]) ** 0.5   # √(1−ᾱ_t)
    sqrt_one_minus_alpha_prod = sqrt_one_minus_alpha_prod.flatten()
    while len(sqrt_one_minus_alpha_prod.shape) < len(original_samples.shape):
        sqrt_one_minus_alpha_prod = sqrt_one_minus_alpha_prod.unsqueeze(-1)

    noisy_samples = sqrt_alpha_prod * original_samples + sqrt_one_minus_alpha_prod * noise
    return noisy_samples`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — DDPM step (역방향, 한 칸 디노이즈)\n추론 루프가 매 스텝 부르는 게 이거다. U-Net이 뱉은 노이즈 예측(`model_output`)을 받아서 (1) 먼저 \"예측된 깨끗한 원본 x_0\"를 역산하고, (2) DDPM 사후분포 공식으로 `x_{t-1}`의 평균 μ를 만든 뒤, (3) `t>0`이면 거기에 무작위 노이즈를 한 줌 더한다 — DDPM이 **확률적**인 이유다.",
    },
    {
      type: "code",
      source: `# scheduling_ddpm.py — DDPMScheduler.step (핵심 발췌)
# 1. alphas, betas
alpha_prod_t = self.alphas_cumprod[t]
alpha_prod_t_prev = self.alphas_cumprod[prev_t] if prev_t >= 0 else self.one
beta_prod_t = 1 - alpha_prod_t
current_beta_t = 1 - alpha_prod_t / alpha_prod_t_prev

# 2. 예측 노이즈 -> 예측 x_0  (prediction_type == "epsilon")
pred_original_sample = (sample - beta_prod_t ** 0.5 * model_output) / alpha_prod_t ** 0.5

# 4~5. x_0 와 x_t 를 가중합해 x_{t-1} 평균 µ 계산 (DDPM 식 (7))
pred_original_sample_coeff = (alpha_prod_t_prev ** 0.5 * current_beta_t) / beta_prod_t
current_sample_coeff = (alpha_prod_t / alpha_prod_t_prev) ** 0.5 * (1 - alpha_prod_t_prev) / beta_prod_t
pred_prev_sample = pred_original_sample_coeff * pred_original_sample + current_sample_coeff * sample

# 6. t>0 이면 분산 노이즈를 더한다 -> 확률적(stochastic)
variance = 0
if t > 0:
    variance_noise = randn_tensor(model_output.shape, generator=generator,
                                  device=model_output.device, dtype=model_output.dtype)
    variance = (self._get_variance(t) ** 0.5) * variance_noise
pred_prev_sample = pred_prev_sample + variance`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — DDIM step (결정론적·소수 스텝)\n같은 자리에 끼는데 수식이 다르다. DDIM은 예측 x_0를 만든 뒤 \"x_t를 향하는 방향\"을 더해 `x_{t-1}`로 간다. 핵심은 `eta`: `eta=0`이면 무작위 노이즈가 0이라 **완전 결정론적**(같은 시드=같은 그림, 스텝을 건너뛰어도 안정적), `eta=1`이면 DDPM과 같아진다. 이래서 25 스텝 같은 적은 횟수로도 깔끔하게 나온다.",
    },
    {
      type: "code",
      source: `# scheduling_ddim.py — DDIMScheduler.step (핵심 발췌)
# 1. 이전 스텝 인덱스
prev_timestep = timestep - self.config.num_train_timesteps // self.num_inference_steps
alpha_prod_t = self.alphas_cumprod[timestep]
alpha_prod_t_prev = self.alphas_cumprod[prev_timestep] if prev_timestep >= 0 else self.final_alpha_cumprod
beta_prod_t = 1 - alpha_prod_t

# 3. 예측 x_0 와 예측 노이즈 (epsilon)
pred_original_sample = (sample - beta_prod_t ** 0.5 * model_output) / alpha_prod_t ** 0.5
pred_epsilon = model_output

# 5. eta 로 무작위성 조절: eta=0 -> DDIM(결정론), eta=1 -> DDPM
variance = self._get_variance(timestep, prev_timestep)
std_dev_t = eta * variance ** 0.5

# 6~7. "x_t 방향" 을 더해 x_{t-1} 로 (식 (12))
pred_sample_direction = (1 - alpha_prod_t_prev - std_dev_t ** 2) ** 0.5 * pred_epsilon
prev_sample = alpha_prod_t_prev ** 0.5 * pred_original_sample + pred_sample_direction

if eta > 0:   # eta=0 이면 이 블록을 건너뛴다 = 노이즈 0
    variance_noise = randn_tensor(model_output.shape, generator=generator,
                                  device=model_output.device, dtype=model_output.dtype)
    prev_sample = prev_sample + std_dev_t * variance_noise`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 적은 스텝으로 빠르게, 그리고 밝기 교정\n스케줄러 교체는 추론 최적화의 1번 레버다. 같은 가중치로 `DPMSolverMultistepScheduler`(DPM++) 같은 고차 솔버를 끼우면 20~25 스텝으로도 충분하고, NVIDIA의 **Align Your Steps(AYS)** 타임스텝을 넘기면 10 스텝까지 줄어든다. 또 `timestep_spacing=\"trailing\"` + `rescale_betas_zero_snr=True`는 v_prediction 모델의 밝기 극단(아주 밝거나 어두운 장면) 문제를 푼다.",
    },
    {
      type: "code",
      source: `from diffusers import DPMSolverMultistepScheduler
from diffusers.schedulers import AysSchedules

# (1) 고차 솔버 + trailing 간격 -> 스텝 수 절감
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config,
    algorithm_type="sde-dpmsolver++",
    timestep_spacing="trailing",
)

# (2) Align Your Steps: 10스텝 고품질 타임스텝을 직접 주입
sampling_schedule = AysSchedules["StableDiffusionXLTimesteps"]
image = pipe(
    "a cinematic shot of a rabbit in a jacket",
    timesteps=sampling_schedule,        # num_inference_steps 대신 명시 타임스텝
).images[0]`,
    },
  ],
};

export default doc;
