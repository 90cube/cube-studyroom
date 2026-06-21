import type { StudyDoc } from "@/models/study";

// 소스 근거: diffusers/src/diffusers/pipelines/pipeline_utils.py (components 프로퍼티),
// pipelines/auto_pipeline.py (AutoPipelineForText2Image, from_pipe). RESEARCH-NOTES-applied.md A절.

const doc: StudyDoc = {
  id: "a1-pipeline-parts",
  title: "파이프라인 = 부품 묶음",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 파이프라인은 '부품 묶음'이다\n`StableDiffusionPipeline`은 통짜 마법상자가 아니야. 생성자(`__init__`)가 받는 건 **vae · text_encoder · tokenizer · unet · scheduler · safety_checker · feature_extractor** 같은 독립 부품들이고, 파이프라인은 그걸 한 객체에 꽂아 호출 순서만 엮어둔 거야. 그래서 부품 하나를 알면 그것만 빼서 갈아끼울 수 있어.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 — 부품을 속성으로 꺼내본다\n불러온 파이프라인의 부품은 전부 속성으로 노출돼. `pipe.unet` · `pipe.vae` · `pipe.scheduler` · `pipe.text_encoder`처럼 점 찍어 바로 만져. 부품이 그냥 nn.Module / 설정 객체라서, 타입·설정·디바이스를 직접 찍어볼 수 있어.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionPipeline

pipe = StableDiffusionPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to("cuda")

# 부품은 전부 속성으로 꽂혀 있다 — 점 찍어 바로 꺼낸다
print(type(pipe.unet))        # UNet2DConditionModel
print(type(pipe.vae))         # AutoencoderKL
print(type(pipe.scheduler))   # PNDMScheduler (이 repo의 기본값)
print(pipe.text_encoder.config.hidden_size)  # text_encoder도 그냥 nn.Module

# components: 부품 전체를 dict 로 — 재조립할 때 그대로 넘긴다
print(pipe.components.keys())
# dict_keys(['vae', 'text_encoder', 'tokenizer', 'unet', 'scheduler',
#            'safety_checker', 'feature_extractor', 'image_encoder'])`,
    },
    {
      type: "markdown",
      source:
        "## 동작 — 생성자 재조립으로 일부만 갈아끼운다\n부품이 dict로 나오니까, 그걸 풀어서(`**pipe.components`) 새 파이프라인 생성자에 넘기면 **가중치 재할당 없이** 같은 부품으로 다른 태스크 파이프라인을 만들 수 있어. 바꾸고 싶은 부품만 키워드로 덮어쓰면 그 자리만 교체돼 — 나머지는 메모리에 있던 객체를 그대로 공유해.",
    },
    {
      type: "code",
      source: `from diffusers import StableDiffusionImg2ImgPipeline, AutoencoderKL

# text2img 의 부품을 그대로 재사용해 img2img 파이프라인으로 재조립
# (같은 가중치를 두 번 로드하지 않는다 — 추가 메모리 0)
img2img = StableDiffusionImg2ImgPipeline(**pipe.components)

# 한 부품만 갈아끼우고 싶으면 그 키만 덮어쓴다
better_vae = AutoencoderKL.from_pretrained(
    "stabilityai/sd-vae-ft-mse", torch_dtype=torch.float16
).to("cuda")

# components dict 를 복사해 vae 만 교체 후 재조립
parts = pipe.components
parts["vae"] = better_vae
pipe_new_vae = StableDiffusionPipeline(**parts)`,
    },
    {
      type: "markdown",
      source:
        "## 동작 — from_pipe: 부품 재사용으로 태스크 전환\n재조립을 더 깔끔하게 해주는 게 `AutoPipelineForX.from_pipe`야. 이미 로드된 파이프라인을 통째로 넘기면, 클래스 이름을 패턴 매칭해서 **그에 대응하는 다른 태스크 파이프라인**을 골라주고, 가진 부품을 전부 재사용해 추가 메모리 없이 새 파이프라인을 만들어. text2img ↔ img2img ↔ inpaint를 부품 공유로 오갈 때 쓴다.",
    },
    {
      type: "code",
      source: `from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image

pipe_t2i = AutoPipelineForText2Image.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
    requires_safety_checker=False,
).to("cuda")

# from_pipe: 부품을 재사용해 같은 모델의 img2img 버전으로 전환 (메모리 추가 없음)
pipe_i2i = AutoPipelineForImage2Image.from_pipe(pipe_t2i)

image = pipe_i2i("turn it into a watercolor", image=init_image).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — AutoPipeline: repo만 주면 클래스 자동 선택\n어떤 파이프라인 클래스를 써야 할지 외울 필요 없어. `AutoPipelineForText2Image / Image2Image / Inpainting`에 repo id만 주면, 그 체크포인트에 맞는 구체 클래스(SD·SDXL·Kandinsky 등)를 알아서 골라 인스턴스를 돌려줘. 부품 묶음을 '태스크 단위'로 다루는 가장 높은 추상화야.",
    },
    {
      type: "code",
      source: `from diffusers import AutoPipelineForText2Image
import torch

# repo 만 주면 SD/SDXL/... 중 맞는 파이프라인 클래스를 자동 선택
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

print(pipe.__class__.__name__)   # StableDiffusionXLPipeline 으로 해석됨
image = pipe("a neon cyberpunk city at night").images[0]`,
    },
  ],
};

export default doc;
