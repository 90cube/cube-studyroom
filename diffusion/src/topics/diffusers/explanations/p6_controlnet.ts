import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — load controlnet + pipeline
  {
    text: "먼저 구조 조건부터 만들어. 원본 이미지에서 cv2.Canny로 윤곽선을 뽑고, 흑백 한 채널을 3채널로 쌓아 RGB 모양으로 맞춰 — ControlNet 입력은 3채널이거든. 그다음 Canny 전용 ControlNet 가중치(sd-controlnet-canny)를 따로 불러서, SD1.5 파이프라인에 controlnet= 인자로 끼워. 여기서 controlnet은 본체 옆에 붙는 곁가지라는 점이 핵심이야 — 본체 U-Net은 그대로 두고 가지만 바꿔 끼우는 구조.",
    imports: [
      {
        name: "StableDiffusionControlNetPipeline",
        what: "SD1.5 + ControlNet 결합 파이프라인",
        use: "controlnet= 로 가지를 끼우고 image=로 조건을 넘겨 호출",
      },
      {
        name: "ControlNetModel",
        what: "조건 이미지 → residual 을 만드는 곁가지 모델 (이 파트 주인공)",
        use: "Canny 사전학습 가중치를 불러와 파이프라인에 주입",
      },
      {
        name: "cv2",
        what: "OpenCV — 이미지 처리",
        use: "Canny 엣지 검출로 윤곽선 조건 이미지를 생성",
      },
      {
        name: "load_image",
        what: "URL·경로 → PIL 헬퍼",
        use: "원본 방 사진을 읽어 numpy로 변환",
      },
    ],
  },
  // 1 — pipe call
  "이제 윤곽은 고정한 채 내용만 갈아끼워. image=canny로 구조 조건을 넘기고, controlnet_conditioning_scale로 그 조건을 얼마나 강하게 따를지 정해 — 0이면 ControlNet을 통째로 무시(=일반 생성)하고, 1.0이면 윤곽을 빡세게 지켜. 0.8쯤이 보통 구조는 살리면서 프롬프트 자유도도 주는 스윗스팟이야. 같은 방 윤곽에 프롬프트만 바꾸면 가구 톤·분위기가 통째로 바뀌면서 레이아웃은 유지돼.",
  // 2 — conditioning embedding (architecture)
  {
    text: "조건 이미지는 512×512 픽셀인데 U-Net 특징맵은 64×64라 해상도를 맞춰야 해. ControlNetConditioningEmbedding이 그 일을 해 — 4번의 stride-2 conv로 512를 64까지 줄이면서 채널은 16→32→96→256으로 키워. 제일 중요한 건 conv_out이 zero_module로 0 초기화된다는 점이야('zero convolution'). 학습 첫 순간엔 ControlNet이 0을 더해서 원본 U-Net을 전혀 안 건드리고, 거기서부터 천천히 영향력을 키워가 — 그래서 사전학습 모델을 망치지 않고 안전하게 미세조정돼.",
    diagram: {
      title: "ControlNetConditioningEmbedding (조건 → 64×64)",
      kind: "architecture",
      summary: `flowchart TD
  C["조건 이미지<br/>(B,3,512,512)"] --> CIN["conv_in 3×3 + SiLU<br/>ch → 16"]
  CIN --> B["stride-2 conv 블록 ×3<br/>512 → 256 → 128 → 64"]
  B --> ZC["conv_out (zero conv)<br/>0 초기화 → 64×64"]
  ZC --> OUT["조건 임베딩<br/>U-Net conv 출력에 더함"]`,
      detail: `flowchart TD
  C["conditioning (B,3,512,512)"] --> CI["conv_in: Conv 3×3 pad1<br/>3 → 16"]
  CI --> A1["SiLU"]
  A1 --> L1["블록쌍 i=0<br/>Conv(16→16) · Conv stride2(16→32)"]
  L1 --> L2["블록쌍 i=1<br/>Conv(32→32) · Conv stride2(32→96)"]
  L2 --> L3["블록쌍 i=2<br/>Conv(96→96) · Conv stride2(96→256)"]
  L3 --> CO["conv_out = zero_module(Conv 256→320)"]
  CO --> Z["출력: 학습 초반 = 0<br/>(원본 안 건드림)"]`,
    },
  },
  // 3 — forward residual (algorithm)
  {
    text: "ControlNet forward의 진짜 메커니즘이야. 순서대로 시켜: (2) 조건 임베딩을 U-Net 첫 conv 출력에 더해 조건을 주입하고, (3~4) 본체와 똑같은 down/mid 블록을 통과시키면서 각 해상도의 중간 출력을 전부 모아. (5) 그 출력들을 또 0초기화된 controlnet_down_blocks(zero conv)에 통과시켜 residual로 만들어 — 학습 초반엔 여기서도 전부 0. (6) 마지막에 conditioning_scale을 곱해 세기를 조절해. 이렇게 만든 down/mid residual을 파이프라인이 받아서 원본 U-Net의 대응 블록 출력에 더해 — 그게 '구조 제어'의 실체야.",
    diagram: {
      title: "ControlNet forward: 조건 → residual",
      kind: "algorithm",
      summary: `flowchart TD
  IN["noisy latent + timestep<br/>+ 텍스트 + 조건이미지"] --> ADD["conv_in(sample) + 조건임베딩"]
  ADD --> BLK["down/mid 블록 통과<br/>(본체와 같은 구조)"]
  BLK --> ZC["zero conv 통과 → residual"]
  ZC --> SC["× conditioning_scale"]
  SC --> OUT["down/mid residual<br/>→ 원본 U-Net에 더함"]`,
      detail: `flowchart TD
  S["sample = conv_in(latent)"] --> CC["+ controlnet_cond_embedding(조건)"]
  CC --> D["for down_block:<br/>통과 + res_samples 누적"]
  D --> M["mid_block 통과"]
  M --> ZD["down 출력들 → controlnet_down_blocks<br/>(각 zero conv)"]
  M --> ZM["mid 출력 → controlnet_mid_block (zero conv)"]
  ZD --> G{"guess_mode ?"}
  ZM --> G
  G -->|예| LS["scale = logspace(−1,0)<br/>얕은블록 0.1 → mid 1.0"]
  G -->|아니오| CS["scale = conditioning_scale (균일)"]
  LS --> R["down/mid residual 반환"]
  CS --> R
  R --> U["파이프라인: 원본 U-Net 대응 블록에 + residual"]`,
    },
  },
  // 4 — multi-controlnet
  {
    text: "구조 조건을 둘 이상 겹치고 싶으면 전부 리스트로 줘. ControlNet 모델 리스트, 조건 이미지 리스트, conditioning_scale 리스트 — 길이를 맞춰서. 예를 들어 Canny로 윤곽을 잡고 Depth로 입체감을 동시에 먹이면, 각 ControlNet이 만든 residual이 합산돼서 U-Net에 더해져. 캐릭터 시트(같은 포즈, 다른 의상), 제품 목업, 건축 시각화처럼 '레이아웃은 고정하고 외형만 변주'하는 프로덕션 워크플로우의 뼈대야. SDXL이라 fp16-fix VAE도 같이 끼웠어.",
    imports: [
      {
        name: "StableDiffusionXLControlNetPipeline",
        what: "SDXL + (멀티)ControlNet 파이프라인",
        use: "controlnet= 에 리스트를 넘겨 여러 조건을 동시에 주입",
      },
      {
        name: "ControlNetModel",
        what: "여기선 Canny·Depth 두 개를 각각 인스턴스화",
        use: "리스트로 묶어 파이프라인에 전달",
      },
      {
        name: "AutoencoderKL",
        what: "SDXL fp16 안전 VAE",
        use: "madebyollin/sdxl-vae-fp16-fix 로 NaN 방지",
      },
    ],
  },
  // 5 — guess_mode
  "프롬프트를 비우고 구조만으로 그리게 하는 모드야. 빈 문자열을 프롬프트로 주고 guess_mode=True를 켜면, 위 forward의 6번 분기에서 residual 세기를 균일 곱 대신 torch.logspace(-1, 0)으로 깔아줘 — 얕은 블록은 0.1, mid는 1.0으로. 즉 깊은(추상적) 층일수록 조건을 더 강하게 반영해서, 텍스트 안내 없이도 ControlNet 인코더가 입력 구조를 스스로 해석해 형태를 만들어내. 스케치 한 장 던지고 '알아서 채워봐' 하는 빠른 컨셉 탐색용이고, guidance_scale은 3~5를 권장해.",
];

export default explanations;
