import type { StudyDoc } from "@/models/study";

// 소스: diffusers/src/diffusers/models/unets/unet_2d_condition.py
// 핵심 발췌 — forward: timestep 임베딩, down/mid/up 블록, cross-attention(encoder_hidden_states) 주입.

const doc: StudyDoc = {
  id: "p3-unet",
  title: "U-Net",
  cells: [
    {
      type: "markdown",
      source:
        "## 사용법 — 노이즈를 예측하는 본체\n`UNet2DConditionModel`은 디노이징 루프의 심장이다. 입력 3개를 받는다: **노이즈 낀 latent**(`sample`), **현재 스텝**(`timestep`), **텍스트 임베딩**(`encoder_hidden_states`). 출력은 그 스텝의 **예측 노이즈**다. 파이프라인 없이 직접 한 번 굴려보면 인터페이스가 명확해진다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import UNet2DConditionModel

unet = UNet2DConditionModel.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    subfolder="unet", torch_dtype=torch.float16,
).to("cuda")

sample = torch.randn(1, 4, 64, 64, dtype=torch.float16, device="cuda")   # 노이즈 latent
timestep = torch.tensor([10], device="cuda")                              # 어느 노이즈 레벨인지
text_emb = torch.randn(1, 77, 768, dtype=torch.float16, device="cuda")    # CLIP 텍스트 임베딩

noise_pred = unet(sample, timestep, encoder_hidden_states=text_emb).sample
print(noise_pred.shape)   # torch.Size([1, 4, 64, 64]) — 입력 latent와 같은 모양`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 ① — timestep 임베딩\n`forward`가 가장 먼저 하는 일. 정수 스텝 `t`를 사인/코사인 주파수 벡터로 펼치고(`time_proj`), MLP(`time_embedding`)로 임베딩 `emb`를 만든다. 이 `emb`는 모든 ResNet 블록에 더해져서 \"지금 노이즈가 얼마나 낀 단계인지\"를 알려준다 — 같은 가중치가 모든 스텝을 처리할 수 있는 비결이다. (SDXL이면 해상도·crop 정보가 `aug_emb`로 여기 합쳐진다.)",
    },
    {
      type: "code",
      source: `# unet_2d_condition.py — forward (발췌): 1. time
t_emb = self.get_time_embed(sample=sample, timestep=timestep)
emb = self.time_embedding(t_emb, timestep_cond)

# (선택) 클래스/해상도 등 추가 조건을 emb 에 더한다 — SDXL 등
class_emb = self.get_class_embed(sample=sample, class_labels=class_labels)
if class_emb is not None:
    emb = emb + class_emb
aug_emb = self.get_aug_embed(
    emb=emb, encoder_hidden_states=encoder_hidden_states, added_cond_kwargs=added_cond_kwargs
)
emb = emb + aug_emb if aug_emb is not None else emb

# 텍스트 임베딩 후처리(IP-Adapter면 (text, image) 튜플로 변환)
encoder_hidden_states = self.process_encoder_hidden_states(
    encoder_hidden_states=encoder_hidden_states, added_cond_kwargs=added_cond_kwargs
)

# 2. pre-process: latent를 채널 폭으로 펼치는 첫 conv
sample = self.conv_in(sample)`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 ② — down / mid / up 블록 + cross-attention 주입\nU자 구조의 본체. **down**에서 해상도를 줄이며 특징을 뽑고, **mid**에서 가장 압축된 표현을 처리하고, **up**에서 다시 키우되 down의 출력(`res_samples`)을 skip-connection으로 받아 디테일을 복원한다. 핵심: **cross-attention이 있는 블록에만** `temb=emb`(시간)와 `encoder_hidden_states`(텍스트)가 함께 흘러들어간다 — 텍스트가 이미지에 개입하는 지점이 바로 여기다.",
    },
    {
      type: "code",
      source: `# unet_2d_condition.py — forward (발췌): 3.down -> 4.mid -> 5.up
# 3. down: 해상도 ↓, skip 출력 저장
down_block_res_samples = (sample,)
for downsample_block in self.down_blocks:
    if downsample_block.has_cross_attention:
        # 텍스트가 들어가는 블록: temb(시간) + encoder_hidden_states(텍스트)
        sample, res_samples = downsample_block(
            hidden_states=sample, temb=emb,
            encoder_hidden_states=encoder_hidden_states,
            cross_attention_kwargs=cross_attention_kwargs,
        )
    else:
        sample, res_samples = downsample_block(hidden_states=sample, temb=emb)
    down_block_res_samples += res_samples

# 4. mid: 가장 압축된 표현 (보통 cross-attention 포함)
if self.mid_block is not None:
    sample = self.mid_block(
        sample, emb,
        encoder_hidden_states=encoder_hidden_states,
        cross_attention_kwargs=cross_attention_kwargs,
    )

# 5. up: 해상도 ↑ + skip 연결(res_samples 꺼내 합치기)
for i, upsample_block in enumerate(self.up_blocks):
    res_samples = down_block_res_samples[-len(upsample_block.resnets):]
    down_block_res_samples = down_block_res_samples[: -len(upsample_block.resnets)]
    if upsample_block.has_cross_attention:
        sample = upsample_block(
            hidden_states=sample, temb=emb, res_hidden_states_tuple=res_samples,
            encoder_hidden_states=encoder_hidden_states,
            cross_attention_kwargs=cross_attention_kwargs,
        )
    else:
        sample = upsample_block(
            hidden_states=sample, temb=emb, res_hidden_states_tuple=res_samples,
        )

# 6. post-process: 다시 4채널 노이즈 예측으로
sample = self.conv_out(self.conv_act(self.conv_norm_out(sample)))`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 블록 사이에 residual을 끼워 구조를 제어한다\n`forward`를 자세히 보면 `down_block_additional_residuals`와 `mid_block_additional_residual` 인자가 있다. **ControlNet**과 **T2I-Adapter**가 정확히 이 통로로 들어온다: 곁가지 네트워크가 edge·pose·depth 같은 조건에서 residual을 만들어 down/mid 출력에 더하면, U-Net 가중치는 그대로 두고 **형태만** 제어된다. 파이프라인이 이걸 자동으로 배선해 준다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers.utils import load_image

# 곁가지: canny edge 조건을 받는 ControlNet
controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny", torch_dtype=torch.float16
)
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    controlnet=controlnet, torch_dtype=torch.float16,
).to("cuda")

canny = load_image("canny_edges.png")   # 윤곽 맵
# 내부적으로 controlnet 이 만든 residual이 unet 의
# down_block_additional_residuals / mid_block_additional_residual 로 더해진다
image = pipe(
    "a futuristic city at dusk",
    image=canny,
    controlnet_conditioning_scale=0.8,   # residual 을 얼마나 세게 더할지
).images[0]`,
    },
  ],
};

export default doc;
