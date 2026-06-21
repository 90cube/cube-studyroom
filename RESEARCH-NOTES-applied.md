# 리서치 노트 — "응용" 토픽 (검증된 사실, 작성 근거)

> 이 토픽 콘텐츠를 쓸 때 이 사실들만 근거로 쓴다. 추가로 의심되면 로컬 소스(`E:\Analysis\diffusers-analysis\diffusers\src\diffusers`) 또는 WebSearch로 확인. GOAL.md 준수.

## A. 파이프라인 = 부품 묶음 (로컬 소스 확인됨)
- `StableDiffusionPipeline.__init__`의 부품: **vae, text_encoder, tokenizer, unet, scheduler, safety_checker, feature_extractor, image_encoder**. 파이프라인은 이 부품들을 한 객체에 묶어 둔 것일 뿐.
- 꺼내기: `pipe.unet`, `pipe.vae`, `pipe.scheduler`, `pipe.text_encoder` 등 속성으로 접근.
- 교체:
  - 스케줄러: `pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)`
  - 재조립: `StableDiffusionPipeline(vae=..., unet=..., scheduler=..., text_encoder=..., tokenizer=..., ...)` 로 일부만 갈아끼워 새 파이프라인 생성.
  - `AutoPipelineForText2Image/Image2Image/Inpainting.from_pipe(other_pipe, ...)`: 이미 로드된 파이프라인의 **부품을 재사용**해 다른 태스크 파이프라인을 메모리 추가 없이 만든다. (`from_pipe`는 `DiffusionPipeline`이 아니라 **AutoPipelineForX** 클래스들에 정의됨 — 소스 확인.)
  - `AutoPipelineForText2Image / Image2Image / Inpainting`: repo만 주면 맞는 파이프라인 클래스를 자동 선택.

## B. 가속 = 증류(distillation) (공통 원리)
느린 teacher(수십 스텝) → 빠른 student(1~8 스텝)로 **변환**. "무엇을 변환?" = 같은 데이터 분포를 적은 스텝으로 풀도록 모델(가중치)을 다시 학습/증류. 방법(레시피)이 기법마다 다름:

- **LCM (Latent Consistency Model)** — consistency distillation. teacher(guided diffusion)를 잠재공간에서 증류, **augmented Probability Flow ODE**의 어느 점에서든 해답으로 '직행'하도록 학습 → 2~4(심지어 1) 스텝. `LCMScheduler` 사용. 추론 시 `num_inference_steps≈4`, `guidance_scale` 낮게(예 1.0; 보통 0~2).
- **LCM-LoRA** — LCM을 **LoRA 어댑터로** 만들어, 어떤 SD/SDXL 베이스에든 학습 없이 끼우는 **범용 가속 모듈**(~100MB). `pipe.load_lora_weights(lcm_lora_repo)` + `LCMScheduler`.
- **SDXL-Lightning** (ByteDance) — **progressive + adversarial** distillation. 판별자(discriminator) = SDXL **자기 U-Net**(잠재공간). 1/2/4/8 스텝 체크포인트(LoRA 또는 풀 UNet). 1024² 지원. 적용 시 보통 `guidance_scale=0`, 정해진 timesteps.
- **SDXL-Turbo / SD-Turbo** (Stability) — **ADD (Adversarial Diffusion Distillation)**. 판별자 = **DINOv2**(픽셀공간). student는 사전학습 가중치로 초기화. 1~4 스텝, `guidance_scale=0.0`. 실시간급.
- **Hyper-SD** (간단 언급) — trajectory-segmented consistency distillation + human feedback. 1~8 스텝.

핵심 비교 한 줄: **LCM=consistency(ODE 직행)**, **Lightning=progressive+adversarial(UNet 판별자)**, **Turbo=ADD(DINOv2 픽셀 판별자)**. 셋 다 "느린→빠른" 증류지만 *증류 방식*과 *판별자*가 다르다.

## 출처
- LCM/LCM-LoRA: huggingface.co/blog/lcm_lora, huggingface.co/docs/diffusers/using-diffusers/inference_with_lcm_lora, arxiv 2311.05556
- Lightning: arxiv 2402.13929 (Progressive Adversarial Diffusion Distillation)
- Turbo: Stability ADD; 비교 baseten.co/blog/comparing-few-step-image-generation-models
- 파이프라인 부품/from_pipe: 로컬 diffusers 소스 + huggingface.co/docs/diffusers/using-diffusers/loading
