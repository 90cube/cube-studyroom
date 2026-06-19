import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p1-usage",
  title: "사용법",
  cells: [
    { type: "markdown", source: "## 가장 기본 — 세 줄이면 그림이 나온다\n사전학습된 Stable Diffusion 가중치를 통째로 불러와 프롬프트만 주면 된다." },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionPipeline

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to("cuda")

image = pipe("a photo of an astronaut riding a horse").images[0]
image.save("astro.png")`,
    },
    { type: "markdown", source: "## 자주 쓰는 옵션\n품질·속도·재현성을 조절하는 핵심 인자들." },
    {
      type: "code",
      source: `image = pipe(
    prompt="a cozy cabin in the snow, highly detailed",
    negative_prompt="blurry, lowres",
    num_inference_steps=30,   # 스텝 수 (품질 ↔ 속도)
    guidance_scale=7.5,       # 프롬프트 충실도 (CFG)
    height=512, width=512,
    generator=torch.Generator("cuda").manual_seed(42),  # 재현용 시드
).images[0]`,
    },
    { type: "markdown", source: "## 스케줄러(샘플러) 바꿔 끼우기\n같은 모델에 샘플러만 교체할 수 있다 — 왜 가능한지는 Part 2에서 본다." },
    {
      type: "code",
      source: `from diffusers import DDIMScheduler

pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
# 모델은 그대로, 역확산 방식만 DDIM으로 교체`,
    },
  ],
};

export default doc;
