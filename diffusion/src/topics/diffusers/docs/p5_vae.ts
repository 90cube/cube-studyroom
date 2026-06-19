import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p5-vae",
  title: "내용",
  cells: [
    {
      type: "markdown",
      source:
        "## VAE는 이미지 ↔ latent 변환기\n`AutoencoderKL`은 512×512×3 픽셀 이미지를 64×64×4 짜리 작은 **latent**로 압축(encode)하고, 다시 픽셀로 복원(decode)한다. SD의 denoising 루프는 이 64×64 잠재공간에서만 돌아 — 픽셀 공간보다 가로·세로 8배씩, 즉 약 48배 싸다. 그래서 한 장의 GPU로 고해상도가 감당된다.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 — 직접 encode / decode 해보기\n파이프라인이 내부에서 부르는 걸 손으로 해보면 감이 온다. 핵심은 `scaling_factor`로 한 번 곱하고(인코딩 후), 디코딩 전에 다시 나누는 것.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoencoderKL
from diffusers.utils import load_image
from torchvision import transforms

vae = AutoencoderKL.from_pretrained(
    "stabilityai/stable-diffusion-2-1", subfolder="vae", torch_dtype=torch.float16
).to("cuda")

img = load_image("cat.png").resize((512, 512))
x = transforms.ToTensor()(img).unsqueeze(0).to("cuda", torch.float16)
x = x * 2.0 - 1.0   # VAE는 [-1, 1] 범위를 기대해

# 인코딩: 이미지 -> latent 분포 -> 샘플 -> scaling_factor 곱
with torch.no_grad():
    latent_dist = vae.encode(x).latent_dist      # DiagonalGaussianDistribution
    z = latent_dist.sample()                     # (1, 4, 64, 64)
    z = z * vae.config.scaling_factor            # 0.18215

print(z.shape)   # torch.Size([1, 4, 64, 64]) — 64배 적은 픽셀 수`,
    },
    {
      type: "code",
      source: `# 디코딩: scaling_factor 되돌리고 -> 픽셀
with torch.no_grad():
    z = z / vae.config.scaling_factor
    recon = vae.decode(z).sample                 # (1, 3, 512, 512)

recon = (recon / 2 + 0.5).clamp(0, 1)            # [-1,1] -> [0,1]
# recon을 PIL로 바꿔 저장하면 원본과 거의 똑같은 고양이가 나와`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 — `encode`는 분포를, `decode`는 픽셀을\n실제 소스(`autoencoder_kl.py`)의 핵심만 추렸다. `encode`는 텐서 하나가 아니라 **가우시안 분포**(`DiagonalGaussianDistribution`)를 돌려준다 — VAE니까 평균·분산을 내놓고, 거기서 샘플(또는 `.mode()`)을 뽑는다.",
    },
    {
      type: "code",
      source: `@apply_forward_hook
def encode(self, x, return_dict=True):
    # use_slicing이면 배치를 한 장씩 쪼개 encode (메모리 절약)
    if self.use_slicing and x.shape[0] > 1:
        encoded_slices = [self._encode(x_slice) for x_slice in x.split(1)]
        h = torch.cat(encoded_slices)
    else:
        h = self._encode(x)
    # h = 평균+로그분산이 채널로 붙은 텐서 -> 분포 객체로 감쌈
    posterior = DiagonalGaussianDistribution(h)
    return AutoencoderKLOutput(latent_dist=posterior)

def _encode(self, x):
    # 큰 이미지면 타일로 쪼개 인코딩
    if self.use_tiling and (width > ... or height > ...):
        return self._tiled_encode(x)
    enc = self.encoder(x)                 # Conv 다운샘플 스택: 512 -> 64
    if self.quant_conv is not None:
        enc = self.quant_conv(enc)        # 1x1 conv로 분포 파라미터 정리
    return enc`,
    },
    {
      type: "code",
      source: `@apply_forward_hook
def decode(self, z, return_dict=True, generator=None):
    if self.use_slicing and z.shape[0] > 1:
        decoded_slices = [self._decode(z_slice).sample for z_slice in z.split(1)]
        decoded = torch.cat(decoded_slices)
    else:
        decoded = self._decode(z).sample
    return DecoderOutput(sample=decoded)

def _decode(self, z, return_dict=True):
    if self.use_tiling and (z.shape[-1] > ... or z.shape[-2] > ...):
        return self.tiled_decode(z, return_dict=return_dict)
    if self.post_quant_conv is not None:
        z = self.post_quant_conv(z)       # 디코더 들어가기 전 1x1 conv
    dec = self.decoder(z)                 # Conv 업샘플 스택: 64 -> 512
    return DecoderOutput(sample=dec)`,
    },
    {
      type: "markdown",
      source:
        "## `scaling_factor`가 왜 필요한가\nVAE가 내놓는 raw latent는 분산이 1이 아니다. 디퓨전 모델(U-Net)은 분산 ≈ 1인 입력에서 가장 잘 학습되니까, latent를 단위분산으로 맞춰주는 상수가 필요하다. 그게 `scaling_factor`(SD1.x/2.x = `0.18215`) — 학습 데이터 첫 배치에서 잰 latent의 표준편차다. 그래서 항상 **U-Net에 넣기 전 곱하고, decode 전에 나눈다**.",
    },
    {
      type: "code",
      source: `# autoencoder_kl.py 의 docstring 발췌 — 공식 정의
# scaling_factor (float, defaults to 0.18215):
#   The component-wise standard deviation of the trained latent space.
#   z = z * scaling_factor   (디퓨전 모델에 넣기 전)
#   z = 1 / scaling_factor * z   (디코딩할 때)

# SDXL은 scaling_factor가 0.13025로 다름 — 모델마다 config에서 읽어야 안전
print(vae.config.scaling_factor)`,
    },
    {
      type: "markdown",
      source:
        "## 응용 1 — SDXL fp16 NaN 문제와 `madebyollin/sdxl-vae-fp16-fix`\nSDXL 기본 VAE는 float16에서 디코딩 시 값이 폭주해 검은/NaN 이미지가 나오기 쉽다. diffusers는 `force_upcast=True`로 VAE만 float32로 돌려 피하지만, 그러면 느리고 VRAM을 더 쓴다. 실전에선 fp16에 맞게 재학습된 VAE를 끼워 전체를 float16으로 유지한다 — 프로덕션 SDXL 파이프라인의 표준 패턴이다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionXLPipeline, AutoencoderKL

# fp16에서 안전한 커뮤니티 VAE로 교체
vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix", torch_dtype=torch.float16
)
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    vae=vae,                       # 기본 VAE 대신 주입
    torch_dtype=torch.float16,
).to("cuda")
# 이제 force_upcast 없이 전 구간 fp16 -> 더 빠르고 VRAM 절약`,
    },
    {
      type: "markdown",
      source:
        "## 응용 2 — 큰 이미지를 위한 VAE 타일링 / 슬라이싱\n디코딩은 latent를 픽셀로 펼치는 순간 활성값이 폭발해 OOM이 잘 난다. 배치가 크면 `enable_vae_slicing()`(한 장씩 디코딩), 해상도가 크면 `enable_vae_tiling()`(겹치는 타일로 쪼개 디코딩)으로 메모리를 일정하게 누른다. 위 소스의 `use_slicing`/`use_tiling` 분기가 바로 이걸 켜는 스위치다.",
    },
    {
      type: "code",
      source: `pipe.enable_vae_slicing()   # 배치 디코딩을 1장씩 (다중 이미지 생성 시)
pipe.enable_vae_tiling()    # 큰 해상도를 겹치는 타일로 분할 디코딩

# 1024px+ 업스케일이나 4장 동시 생성에서 OOM 없이 돌아감
images = pipe(["a fox"] * 4, height=1024, width=1024).images`,
    },
  ],
};

export default doc;
