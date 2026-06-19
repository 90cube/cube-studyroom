import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — encode usage
  {
    text: "VAE를 따로 불러와서 손으로 인코딩해봐. 먼저 이미지를 텐서로 만들고 *2−1 해서 [-1,1] 범위로 옮겨 — VAE가 그 범위로 학습됐거든. vae.encode가 텐서 하나가 아니라 '분포'(latent_dist)를 돌려주니까 거기서 .sample()로 한 점을 뽑고, 마지막에 scaling_factor(0.18215)를 곱해. 결과는 64×64×4 — 원본 512×512×3보다 픽셀 수가 64배 적어. 이게 디퓨전이 도는 잠재공간이야.",
    imports: [
      {
        name: "AutoencoderKL",
        what: "이미지↔latent VAE 본체 (이 파트의 주인공)",
        use: "from_pretrained로 vae 서브폴더만 불러와 encode/decode 직접 호출",
      },
      {
        name: "load_image",
        what: "URL·경로에서 PIL 이미지를 읽는 헬퍼",
        use: "고양이 원본을 읽어 512로 리사이즈",
      },
      {
        name: "transforms",
        what: "torchvision 전처리 (ToTensor 등)",
        use: "PIL → 0~1 텐서 변환, 이후 [-1,1]로 스케일",
      },
      {
        name: "torch",
        what: "텐서·GPU·반정밀도",
        use: "float16·cuda 배치, no_grad 컨텍스트",
      },
    ],
  },
  // 1 — decode usage
  "이번엔 거꾸로. scaling_factor로 곱했던 걸 다시 나눠서 VAE가 학습된 스케일로 되돌린 뒤 vae.decode에 넣어 — 64×64 latent가 512×512 픽셀로 펼쳐져. 나온 값은 [-1,1]이니까 /2+0.5로 [0,1]로 옮기고 clamp해. 그러면 원본과 거의 똑같은 고양이가 복원돼. 인코딩→디코딩을 왕복해도 거의 안 깨진다는 게 VAE가 좋은 압축기라는 증거야.",
  // 2 — encode internals
  {
    text: "실제 소스의 encode. 핵심은 두 가지야. 첫째, use_slicing이 켜져 있고 배치가 2장 이상이면 한 장씩 쪼개서 인코딩해 — 메모리를 아끼려고. 둘째, _encode가 돌려준 텐서(평균+로그분산이 채널로 붙어 있어)를 DiagonalGaussianDistribution으로 감싸서 '분포'로 내보내. _encode 안에서는 큰 이미지면 타일로 쪼개고, 아니면 encoder(Conv 다운샘플 스택)로 512를 64까지 줄인 다음 quant_conv(1×1 conv)로 분포 파라미터를 정리해.",
    diagram: {
      title: "encode: 이미지 → latent 분포",
      kind: "algorithm",
      summary: `flowchart TD
  X["이미지 x (B,3,512,512)<br/>범위 [-1,1]"] --> SL{"슬라이싱 ?"}
  SL -->|예| SPLIT["배치를 1장씩 쪼개<br/>각각 _encode"]
  SL -->|아니오| ENC["_encode(x)"]
  SPLIT --> CAT["다시 concat"]
  ENC --> POST["DiagonalGaussianDistribution"]
  CAT --> POST
  POST --> OUT["latent_dist 반환"]`,
      detail: `flowchart TD
  X["x (B,3,512,512)"] --> T{"타일링 & 큰 이미지 ?"}
  T -->|예| TILE["_tiled_encode<br/>겹치는 타일로 분할"]
  T -->|아니오| E["encoder: Conv 다운샘플<br/>512 → 64, 채널 ↑"]
  E --> QC{"quant_conv 있음 ?"}
  QC -->|예| Q["1×1 conv<br/>(평균·로그분산 정리)"]
  QC -->|아니오| SKIP["그대로"]
  Q --> H["h: (B,8,64,64)<br/>= 평균 4 + 로그분산 4"]
  SKIP --> H
  TILE --> H
  H --> D["DiagonalGaussianDistribution(h)"]
  D --> S[".sample() 또는 .mode()<br/>→ z (B,4,64,64)"]`,
    },
  },
  // 3 — decode internals
  {
    text: "decode는 encode의 거울상이야. 배치가 크면 똑같이 한 장씩 쪼개 디코딩하고, _decode 안에서는 큰 latent면 타일로 나눠 디코딩해. 아니면 post_quant_conv(1×1 conv)를 한 번 통과시킨 뒤 decoder(Conv 업샘플 스택)로 64를 512까지 키워. encode가 quant_conv, decode가 post_quant_conv를 쓰는 게 대칭이라는 점만 기억하면 돼.",
    diagram: {
      title: "decode: latent → 이미지",
      kind: "algorithm",
      summary: `flowchart TD
  Z["latent z (B,4,64,64)"] --> SL{"슬라이싱 & 배치>1 ?"}
  SL -->|예| SP["1장씩 _decode 후 concat"]
  SL -->|아니오| DC["_decode(z)"]
  SP --> OUT["픽셀 (B,3,512,512)"]
  DC --> OUT`,
      detail: `flowchart TD
  Z["z (B,4,64,64)"] --> T{"타일링 & 큰 latent ?"}
  T -->|예| TILE["tiled_decode<br/>겹치는 타일 + blend"]
  T -->|아니오| PQ{"post_quant_conv 있음 ?"}
  PQ -->|예| P["1×1 conv"]
  PQ -->|아니오| SKIP["그대로"]
  P --> DEC["decoder: Conv 업샘플<br/>64 → 512, 채널 ↓"]
  SKIP --> DEC
  DEC --> IMG["sample (B,3,512,512)"]
  TILE --> IMG`,
    },
  },
  // 4 — scaling_factor config
  "scaling_factor는 외우지 말고 config에서 읽는 습관을 들여. VAE raw latent는 분산이 1이 아닌데, U-Net은 분산 ≈ 1인 입력을 좋아해. 그래서 학습 첫 배치에서 잰 latent 표준편차를 상수로 박아두고 'U-Net 들어가기 전 곱, decode 전 나눔'을 해. SD1.x/2.x는 0.18215인데 SDXL은 0.13025로 달라 — 그래서 숫자를 하드코딩하면 SDXL에서 색이 떠버려. 항상 vae.config.scaling_factor를 써.",
  // 5 — sdxl-vae-fp16-fix
  {
    text: "프로덕션에서 제일 자주 만나는 VAE 함정이야. SDXL 기본 VAE는 float16으로 디코딩하면 값이 폭주해서 검은 화면이나 NaN이 나와. diffusers는 force_upcast=True로 VAE만 float32로 돌려 피하지만 느리고 VRAM을 더 먹어. 그래서 fp16에 맞게 재학습된 madebyollin/sdxl-vae-fp16-fix를 vae= 인자로 주입해서 갈아끼우면, force_upcast 없이 전 구간을 float16으로 유지할 수 있어 — 더 빠르고 가벼워. SDXL 돌릴 땐 거의 기본 장비처럼 챙기는 패턴이야.",
    imports: [
      {
        name: "StableDiffusionXLPipeline",
        what: "SDXL 텍스트→이미지 파이프라인",
        use: "from_pretrained 시 vae= 로 교체 VAE를 끼워 넣어",
      },
      {
        name: "AutoencoderKL",
        what: "여기선 fp16-fix 가중치를 담는 그릇",
        use: "madebyollin/sdxl-vae-fp16-fix 를 불러와 파이프라인에 주입",
      },
    ],
  },
  // 6 — vae slicing / tiling
  "디코딩은 latent를 픽셀로 펼치는 순간 활성값이 확 늘어서 OOM이 잘 나는 구간이야. 두 스위치로 눌러. enable_vae_slicing()은 4장을 한꺼번에 디코딩하지 말고 1장씩 돌려 — 다중 이미지 생성 시 피크 메모리를 1/N로. enable_vae_tiling()은 큰 해상도를 겹치는 타일로 쪼개 디코딩하고 이음새를 blend로 메워 — 1024px 이상 업스케일에서 유용해. 위 소스의 use_slicing/use_tiling 분기가 바로 이 메서드들이 켜는 플래그야. 둘 다 메모리를 약간의 속도와 맞바꾸는 거라 VRAM이 빠듯할 때만 켜면 돼.",
];

export default explanations;
