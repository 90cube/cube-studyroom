import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p6-controlnet",
  title: "내용",
  cells: [
    {
      type: "markdown",
      source:
        "## ControlNet은 U-Net 옆에 붙는 곁가지\n텍스트만으로는 '이 구도, 이 포즈, 이 윤곽선대로'를 시키기 어렵다. ControlNet은 U-Net의 인코더를 **복제한 작은 가지**에 edge·depth·pose 같은 구조 조건을 따로 먹여, 거기서 나온 신호(residual)를 원본 U-Net 블록에 더한다. 원본 가중치는 얼지 않고 그대로 — 그래서 한 모델에 ControlNet만 갈아끼우면 같은 스타일로 구도만 바꿀 수 있다.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 — Canny 윤곽선으로 구도 잡기\nControlNet 모델을 따로 불러와 `controlnet=`으로 파이프라인에 끼운다. 조건 이미지(여기선 Canny edge)는 `image=`로 넘기고, `controlnet_conditioning_scale`로 얼마나 강하게 따를지 조절한다.",
    },
    {
      type: "code",
      source: `import torch, cv2
import numpy as np
from PIL import Image
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers.utils import load_image

# 1) 원본에서 Canny 윤곽선 뽑기 (이게 '구조 조건')
img = np.array(load_image("room.png"))
edges = cv2.Canny(img, 100, 200)
edges = np.stack([edges] * 3, axis=2)
canny = Image.fromarray(edges)

# 2) Canny용 ControlNet + SD1.5 파이프라인
controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny", torch_dtype=torch.float16
)
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16,
).to("cuda")`,
    },
    {
      type: "code",
      source: `# 3) 윤곽선은 유지한 채 내용만 프롬프트로 바꾸기
image = pipe(
    "a cozy scandinavian living room, warm light, 4k",
    image=canny,                       # 구조 조건 (control image)
    controlnet_conditioning_scale=0.8, # 0이면 무시, 1이면 강하게 따름
    num_inference_steps=30,
    guidance_scale=7.5,
).images[0]
# 원본 방 구조(윤곽)는 그대로, 가구 톤·분위기는 새로 생성됨`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 1 — 조건 이미지를 latent 해상도로 인코딩\n조건 이미지는 512×512 픽셀인데 U-Net 특징맵은 64×64다. `ControlNetConditioningEmbedding`이 4번의 stride-2 conv로 512→64로 줄인다. **마지막 conv는 `zero_module`로 0 초기화** — 학습 시작 시 ControlNet이 원본을 전혀 안 건드리게 해서 안전하게 미세조정된다(논문의 'zero convolution').",
    },
    {
      type: "code",
      source: `class ControlNetConditioningEmbedding(nn.Module):
    def __init__(self, conditioning_embedding_channels, conditioning_channels=3,
                 block_out_channels=(16, 32, 96, 256)):
        self.conv_in = nn.Conv2d(conditioning_channels, block_out_channels[0], 3, padding=1)
        self.blocks = nn.ModuleList([])
        for i in range(len(block_out_channels) - 1):
            ch_in, ch_out = block_out_channels[i], block_out_channels[i + 1]
            self.blocks.append(nn.Conv2d(ch_in, ch_in, 3, padding=1))
            self.blocks.append(nn.Conv2d(ch_in, ch_out, 3, padding=1, stride=2))  # 다운샘플
        # 마지막은 0으로 초기화된 conv (zero convolution)
        self.conv_out = zero_module(
            nn.Conv2d(block_out_channels[-1], conditioning_embedding_channels, 3, padding=1)
        )

    def forward(self, conditioning):
        e = F.silu(self.conv_in(conditioning))
        for block in self.blocks:
            e = F.silu(block(e))
        return self.conv_out(e)            # 0 초기화라 학습 초반엔 0 더함

def zero_module(module):
    for p in module.parameters():
        nn.init.zeros_(p)
    return module`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 2 — residual 만들기 + conditioning_scale 곱\n`forward`에서: 조건 임베딩을 U-Net 첫 conv 출력에 더한 뒤, down/mid 블록을 통과시키며 각 단계 출력을 모은다. 그걸 또 0초기화된 `controlnet_down_blocks`(zero conv)에 통과시켜 **down/mid residual**을 만들고, 마지막에 `conditioning_scale`을 곱한다. 이 residual들이 파이프라인에서 원본 U-Net의 대응 블록에 더해진다.",
    },
    {
      type: "code",
      source: `def forward(self, sample, timestep, encoder_hidden_states,
            controlnet_cond, conditioning_scale=1.0, ...):
    # 2. 조건 이미지를 인코딩해 U-Net 입력에 더함
    sample = self.conv_in(sample)
    controlnet_cond = self.controlnet_cond_embedding(controlnet_cond)
    sample = sample + controlnet_cond

    # 3~4. down/mid 블록 통과하며 각 해상도 출력 수집
    down_block_res_samples = (sample,)
    for downsample_block in self.down_blocks:
        sample, res_samples = downsample_block(sample, temb=emb,
            encoder_hidden_states=encoder_hidden_states)
        down_block_res_samples += res_samples
    sample = self.mid_block(sample, emb, encoder_hidden_states=encoder_hidden_states)

    # 5. zero conv 통과 -> residual (학습 초반엔 전부 0)
    down_block_res_samples = [zc(d) for d, zc
        in zip(down_block_res_samples, self.controlnet_down_blocks)]
    mid_block_res_sample = self.controlnet_mid_block(sample)

    # 6. 세기 조절: conditioning_scale 곱
    down_block_res_samples = [d * conditioning_scale for d in down_block_res_samples]
    mid_block_res_sample = mid_block_res_sample * conditioning_scale
    return down_block_res_samples, mid_block_res_sample`,
    },
    {
      type: "markdown",
      source:
        "## 응용 1 — Multi-ControlNet (Canny + Depth 동시)\n구조 조건을 둘 이상 겹칠 수 있다. ControlNet들을 리스트로 넘기고, 조건 이미지도 리스트, `controlnet_conditioning_scale`도 리스트로 준다. 예: Canny로 윤곽을 잡고 Depth로 입체감을 잡는 식. 캐릭터 시트, 제품 목업, 건축 시각화처럼 '레이아웃은 고정, 외형만 변주' 워크플로우의 핵심이다.",
    },
    {
      type: "code",
      source: `from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel, AutoencoderKL

controlnets = [
    ControlNetModel.from_pretrained("diffusers/controlnet-canny-sdxl-1.0", torch_dtype=torch.float16),
    ControlNetModel.from_pretrained("diffusers/controlnet-depth-sdxl-1.0-small", torch_dtype=torch.float16),
]
vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnets, vae=vae, torch_dtype=torch.float16,
).to("cuda")

images = [canny_image.resize((1024, 1024)), depth_image.resize((1024, 1024))]
out = pipe(
    "a relaxed rabbit by a pool, 35mm photograph, 4k",
    image=images,                              # 조건 이미지 리스트
    controlnet_conditioning_scale=[0.5, 0.5],  # 각 ControlNet 세기
).images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 응용 2 — guess_mode (프롬프트 없이 구조만으로)\n프롬프트를 비우고 조건 이미지만으로 생성하는 모드. 위 `forward`에서 `guess_mode`면 residual 세기를 블록 깊이에 따라 `torch.logspace(-1, 0, ...)`로 깔아준다(얕은 블록 0.1 → mid 1.0). 스케치만 던져 '알아서 그려봐' 하는 빠른 컨셉 탐색에 쓴다(권장 guidance_scale 3~5).",
    },
    {
      type: "code",
      source: `# 프롬프트 빈 문자열 + guess_mode=True
image = pipe(
    "",                       # 프롬프트 없음
    image=canny,
    guess_mode=True,
    guidance_scale=4.0,       # guess_mode 권장 범위 3~5
).images[0]
# ControlNet 인코더가 입력 구조를 스스로 해석해 형태를 만들어냄`,
    },
  ],
};

export default doc;
