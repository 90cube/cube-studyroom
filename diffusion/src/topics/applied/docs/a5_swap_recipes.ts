import type { StudyDoc } from "@/models/study";

// 사실 근거: RESEARCH-NOTES-applied.md (A. 파이프라인=부품 묶음) + 로컬 diffusers 소스로 API 확인.
// - VAE 교체: AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix") — 공식 ControlNet-SDXL 예제와 동일.
// - 멀티 LoRA: pipe.unet.set_adapters([...], weights=[...]) (loaders/peft.py set_adapters 예제).
// - from_pipe: AutoPipeline...from_pipe(pipe, controlnet=...) — 모듈 재사용, 메모리 추가 없음 (auto_pipeline.py).
// - IP-Adapter: load_ip_adapter / set_ip_adapter_scale (loaders/ip_adapter.py).

const doc: StudyDoc = {
  id: "a5-swap-recipes",
  title: "부품 교체 응용 레시피",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 부품을 '하나씩'이 아니라 '조합'해서 쓴다\n여기까지 왔으면 vae·scheduler·unet·LoRA를 다 갈아끼울 수 있지? 실전 워크플로우는 이걸 **동시에** 쓴다 — 안정적인 VAE + 가속 LoRA + 제어(ControlNet/IP-Adapter)를 한 파이프라인에 얹는 거야. 이 파트는 검증된 레시피 셋을 묶는다: ① **VAE 교체**(fp16 NaN 회피), ② **가속 LoRA + ControlNet/IP-Adapter 조합**, ③ **`from_pipe`로 재로딩 없이 파이프라인 변형**.\n\n전부 Part 1의 '파이프라인 = 부품 묶음'과 Part 4의 '가속 LoRA'를 실전으로 합치는 거야 — 새 개념이 아니라 조립이야.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 ① — VAE 교체로 fp16 NaN 막기\nSDXL 기본 VAE는 fp16(반정밀도)에서 수치가 넘쳐 **검정/NaN 이미지**가 나오는 고질병이 있어. 해결은 부품 교체 한 방 — `madebyollin/sdxl-vae-fp16-fix`(fp16에서 안 터지게 재학습한 VAE)를 `AutoencoderKL`로 불러 `vae=`로 끼운다. VAE는 '잠재 ↔ 픽셀' 변환 부품이라 가중치만 바꿔도 그림 내용은 그대로, 디코딩만 안정돼.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, AutoencoderKL

# fp16에서 안 터지게 재학습된 VAE를 부품으로 끼운다
vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix",
    torch_dtype=torch.float16,
)

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    vae=vae,                     # 기본 VAE 대신 fp16-fix VAE 주입
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

# 이제 fp16에서도 검정/NaN 없이 안정적으로 디코딩
image = pipe("a bowl of ramen, studio light").images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 ② — 가속 LoRA + ControlNet 동시에\n진짜 실전 조합이야. ControlNet(예: canny 엣지로 구도 고정)을 끼운 파이프라인에 **가속 LoRA(LCM)**까지 얹어 — 빠르면서 구도까지 제어돼. 순서: (1) ControlNet 모델과 fp16-fix VAE를 부품으로 넣어 파이프라인을 만들고, (2) LCM-LoRA를 얹고 `LCMScheduler`로 바꾸고, (3) 추론은 적은 스텝 + 낮은 guidance + `controlnet_conditioning_scale`로 제어 강도 조절. ControlNet 가속이라 4스텝으로도 구도가 잡혀.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import (
    StableDiffusionXLControlNetPipeline,
    ControlNetModel, AutoencoderKL, LCMScheduler,
)
from diffusers.utils import load_image

# (1) 제어 부품(ControlNet) + 안정 VAE를 끼워 파이프라인 조립
controlnet = ControlNetModel.from_pretrained(
    "diffusers/controlnet-canny-sdxl-1.0", torch_dtype=torch.float16,
)
vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet, vae=vae, torch_dtype=torch.float16,
).to("cuda")

# (2) 가속 LoRA(LCM)를 얹고 LCM 스케줄러로 교체
pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl")
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

# (3) 적은 스텝 + 낮은 guidance + 제어 강도
canny = load_image("https://hf.co/datasets/hf-internal-testing/diffusers-images/resolve/main/sd_controlnet/hf-logo.png")
image = pipe(
    "a futuristic city skyline at dusk",
    image=canny,
    num_inference_steps=4,
    guidance_scale=1.5,
    controlnet_conditioning_scale=0.5,   # 제어 강도(권장 0.5)
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 사용법 ③ — 가속 LoRA + IP-Adapter (스타일 LoRA와 동시)\n부품 교체는 LoRA를 **여러 개** 동시에도 된다. 여기선 가속 LoRA + 스타일 LoRA를 `set_adapters`로 가중치 섞어 켜고, 거기에 **IP-Adapter**(참조 이미지로 스타일/구도 전달)를 얹어. `load_ip_adapter`로 끼우고 `set_ip_adapter_scale`로 영향력을 조절해 — 텍스트 프롬프트 + 참조 이미지 + 가속을 한 번에 쓰는 풀 조합이야.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, LCMScheduler
from diffusers.utils import load_image

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16, variant="fp16",
).to("cuda")

# (1) LoRA 두 개를 이름 붙여 얹고, 가중치를 섞어 동시 활성화
pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl", adapter_name="lcm")
pipe.load_lora_weights("TheLastBen/Papercut_SDXL", weight_name="papercut.safetensors", adapter_name="paper")
pipe.set_adapters(["lcm", "paper"], adapter_weights=[1.0, 0.8])
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

# (2) IP-Adapter를 얹고 참조 이미지 영향력을 조절
pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
pipe.set_ip_adapter_scale(0.6)

ref = load_image("https://hf.co/datasets/huggingface/documentation-images/resolve/main/diffusers/cat.png")
image = pipe(
    "a papercut art of a cat, pastel",
    ip_adapter_image=ref,
    num_inference_steps=4,
    guidance_scale=1.5,
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — `from_pipe`로 재로딩 없이 파이프라인 변형\n이미 SDXL을 GPU에 올려놨는데 ControlNet 버전이 필요해졌어. 다시 `from_pretrained` 하면 똑같은 vae·unet·text_encoder를 **또** 메모리에 올려 낭비야. `from_pipe`는 이미 로드된 파이프라인의 **부품을 그대로 재사용**해 다른 태스크 파이프라인을 만든다 — 추가 메모리 없이. 새 부품(controlnet)만 인자로 끼워 주면 돼. 반대로 controlnet 없는 버전이 다시 필요하면 `controlnet=None`으로 도로 변형할 수도 있어.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image, ControlNetModel

# 이미 메모리에 올라가 있는 일반 t2i 파이프라인
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16, variant="fp16",
).to("cuda")

# 부품(unet·vae·text_encoder…)을 재사용해 ControlNet 파이프라인으로 변형 — 추가 메모리 없음
controlnet = ControlNetModel.from_pretrained(
    "diffusers/controlnet-canny-sdxl-1.0", torch_dtype=torch.float16,
)
pipe_cn = AutoPipelineForText2Image.from_pipe(pipe, controlnet=controlnet)

# pipe 와 pipe_cn 은 같은 vae·unet·text_encoder 텐서를 공유 (복제 안 함)`,
    },
  ],
};

export default doc;
