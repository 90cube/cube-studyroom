import type { StudyDoc } from "@/models/study";

// 소스 근거: diffusers schedulers (scheduling_euler_discrete / dpmsolver_multistep / ddim / unipc),
// pipeline_utils.py scheduler.compatibles. RESEARCH-NOTES-applied.md A절(스케줄러 교체).

const doc: StudyDoc = {
  id: "a2-samplers",
  title: "샘플러 갈아끼우기",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 모델은 그대로, '되돌리는 법'만 바꾼다\nPart 1에서 봤듯 scheduler는 부품 하나일 뿐이야. U-Net 가중치는 '이 노이즈가 뭔지'만 예측하고, **어떻게 한 스텝씩 되돌릴지(역확산 알고리즘)는 scheduler가 정해**. 그래서 가중치는 1도 안 건드리고 scheduler만 갈아끼우면 속도·품질이 달라져. 같은 모델, 다른 샘플러.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 — from_config 로 알고리즘만 교체\n교체의 관문은 `from_config`야. 기존 scheduler의 설정(`betas` · `num_train_timesteps` · `prediction_type` 등)을 통째로 물려받고 **알고리즘 클래스만** 바꿔 다시 꽂아. 어떤 샘플러로 바꿀 수 있는지는 `pipe.scheduler.compatibles`가 호환 목록으로 알려줘.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import DiffusionPipeline, EulerDiscreteScheduler

pipe = DiffusionPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to("cuda")

# 이 모델에 끼울 수 있는 스케줄러 후보 목록
print(pipe.scheduler.compatibles)

# 설정은 물려받고 역확산 알고리즘만 Euler 로 교체 (가중치는 안 건드림)
pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)

image = pipe("a lighthouse on a cliff", num_inference_steps=25).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 동작 — 샘플러 4종, 무엇이 다른가\n같은 자리에 끼지만 '역확산을 어떻게 밟느냐'가 달라. **Euler**: 1차 ODE 솔버, 단순·안정. **DPM++**(`DPMSolverMultistepScheduler`): 고차 다단계 솔버라 20스텝 안쪽에서도 깔끔. **DDIM**: 결정론적(`eta=0`), 적은 스텝에 강함. **UniPC**(`UniPCMultistepScheduler`): training-free 고차 솔버, 더 적은 스텝을 노려. 전부 `from_config`로 끼우는 법은 똑같아.",
    },
    {
      type: "code",
      source: `from diffusers import (
    DPMSolverMultistepScheduler,
    DDIMScheduler,
    UniPCMultistepScheduler,
)

# DPM++ (고차 다단계) — 20스텝 안쪽도 깔끔
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
img_dpm = pipe("a fox in snow", num_inference_steps=20).images[0]

# DDIM (결정론) — 같은 시드면 같은 그림
pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
img_ddim = pipe("a fox in snow", num_inference_steps=25).images[0]

# UniPC (training-free 고차) — 더 적은 스텝을 노림
pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
img_unipc = pipe("a fox in snow", num_inference_steps=15).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — timestep_spacing 으로 미세 조정\nscheduler를 끼울 때 `from_config`에 옵션을 얹어 일정을 다듬을 수 있어. `timestep_spacing`은 1000개 학습 타임스텝에서 추론용 몇십 개를 **어떻게 고를지**를 정해 — `\"leading\"`(기본·앞쪽 정렬), `\"linspace\"`(균등), `\"trailing\"`(끝점 정렬). 적은 스텝일수록 `\"trailing\"`이 마지막 디테일을 더 살리는 경우가 많아. 가중치 재학습 0, 옵션 한 줄.",
    },
    {
      type: "code",
      source: `from diffusers import DPMSolverMultistepScheduler

# 같은 DPM++ 라도 timestep_spacing 으로 추론 타임스텝 고르는 방식을 바꾼다
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config,
    algorithm_type="sde-dpmsolver++",
    timestep_spacing="trailing",   # 끝점 정렬 — 적은 스텝에서 디테일 보존
)

image = pipe("a cinematic shot of a rabbit in a jacket",
             num_inference_steps=20).images[0]`,
    },
  ],
};

export default doc;
