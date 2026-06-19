import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — usage: standalone unet call
  {
    text: "U-Net을 파이프라인 없이 맨손으로 한 번 굴려봐. 입력 3개만 기억하면 돼 — 노이즈 낀 latent(sample), 지금 어느 노이즈 레벨인지(timestep), 그리고 무슨 그림을 그릴지 알려주는 텍스트 임베딩(encoder_hidden_states). 돌리면 입력 latent와 '똑같은 모양'의 텐서가 나오는데, 이게 그 스텝에 낀 노이즈의 예측이야. 스케줄러가 이걸 받아서 한 칸 디노이즈하지. 즉 U-Net의 일은 딱 하나: '지금 낀 노이즈가 뭐야?'에 답하는 것.",
    imports: [
      {
        name: "UNet2DConditionModel",
        what: "텍스트 조건부 노이즈 예측 본체 (down/mid/up + cross-attention)",
        use: "from_pretrained(subfolder='unet')로 올려 unet(sample, t, encoder_hidden_states=...) 호출",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서 생성·GPU·반정밀도",
        use: "randn으로 더미 latent/임베딩 만들고 timestep 텐서 구성, .to('cuda')",
      },
    ],
  },
  // 1 — timestep embedding
  {
    text: "forward가 제일 먼저 하는 일이야. 정수 스텝 t 하나를 받아서, 사인/코사인 주파수로 펼친 뒤(time_proj) MLP(time_embedding)에 통과시켜 임베딩 emb를 만들어. 이 emb가 왜 중요하냐면 — 이게 down/mid/up 안의 '모든 ResNet 블록'에 더해져서 '지금 노이즈가 얼마나 낀 단계냐'를 알려줘. 덕분에 똑같은 가중치 한 벌이 1000개 스텝을 전부 처리할 수 있어. SDXL이면 여기에 해상도·crop 정보(aug_emb)까지 합쳐지고, 텍스트 임베딩도 이 단계에서 후처리돼(IP-Adapter면 (텍스트, 이미지) 튜플로 쪼개짐).",
    diagram: {
      title: "timestep → 임베딩, 그리고 latent 입력 준비",
      kind: "algorithm",
      summary: `flowchart TD
  T["timestep t (정수)"] --> TP["time_proj: 사인/코사인 주파수"]
  TP --> TE["time_embedding (MLP) → emb"]
  TE --> ADD["+ class/aug emb (SDXL 등 선택)"]
  ADD --> EMB["emb → 모든 ResNet 블록에 주입"]
  S["노이즈 latent"] --> CI["conv_in → 채널 폭 확장"]`,
      detail: `flowchart TD
  T["timestep"] --> GTE["get_time_embed"]
  GTE --> TE["time_embedding(t_emb, timestep_cond)"]
  TE --> E0["emb"]
  CL["class_labels?"] --> CE["get_class_embed"]
  CE -->|있으면| E1["emb = emb + class_emb"]
  E0 --> E1
  EH["encoder_hidden_states + added_cond_kwargs"] --> AE["get_aug_embed (SDXL: 해상도·crop)"]
  AE -->|있으면| E2["emb = emb + aug_emb"]
  E1 --> E2
  EH --> PE["process_encoder_hidden_states<br/>(IP-Adapter면 (text,image) 튜플)"]
  S["sample (latent)"] --> CI["conv_in"]`,
    },
  },
  // 2 — down/mid/up + cross-attention (architecture)
  {
    text: "여기가 U-Net 본체야, 글자 그대로 U자 모양. down에서 해상도를 단계마다 절반씩 줄이며 특징을 짜내고(매 단계 출력은 res_samples로 저장해 둬), mid에서 가장 압축된 표현을 한 번 더 굴리고, up에서 다시 키워. up이 똑똑한 건 저장해 둔 down 출력을 skip-connection으로 같은 해상도에 도로 붙여서 디테일을 살리는 거야. 그리고 가장 중요한 포인트 — has_cross_attention인 블록에만 encoder_hidden_states(텍스트)가 같이 흘러들어가. 텍스트가 그림에 개입하는 곳이 바로 이 cross-attention 지점이고, Part 4에서 그 안을 뜯어볼 거야. temb(시간)는 모든 블록에 가.",
    diagram: {
      title: "U-Net down / mid / up 구조 (텍스트 주입 지점)",
      kind: "architecture",
      summary: `flowchart TD
  IN["conv_in 출력"] --> D["down blocks (해상도 ↓)"]
  D --> M["mid block (최압축)"]
  M --> U["up blocks (해상도 ↑ + skip)"]
  U --> OUT["conv_out → 예측 노이즈"]
  TXT["encoder_hidden_states (텍스트)"] -.cross-attn.-> D
  TXT -.cross-attn.-> M
  TXT -.cross-attn.-> U
  EMB["emb (시간)"] -.모든 블록.-> D
  EMB -.-> M
  EMB -.-> U`,
      detail: `flowchart TD
  CI["conv_in 출력 sample"] --> D1["down block 1<br/>(ResNet + 선택적 cross-attn)"]
  D1 -->|res_samples 저장| D2["down block 2 (해상도 ↓)"]
  D2 -->|res_samples 저장| D3["down block 3 (해상도 ↓)"]
  D3 --> MID["mid block<br/>ResNet + cross-attn + ResNet"]
  MID --> U1["up block 1<br/>+ skip(res_samples pop)"]
  D3 -. skip .-> U1
  U1 --> U2["up block 2 + skip"]
  D2 -. skip .-> U2
  U2 --> U3["up block 3 + skip"]
  D1 -. skip .-> U3
  U3 --> CO["conv_norm_out → conv_act → conv_out"]
  CO --> OUT["예측 노이즈 (4ch)"]
  TXT["encoder_hidden_states"] -. has_cross_attention 블록만 .-> D1
  TXT -.-> MID
  TXT -.-> U1`,
    },
  },
  // 3 — application: ControlNet residual injection
  {
    text: "forward 안에 down_block_additional_residuals / mid_block_additional_residual 인자가 왜 있나 했지? ControlNet과 T2I-Adapter가 정확히 이 통로로 들어와. 곁가지 네트워크한테 canny edge나 pose, depth 같은 구조 조건을 주면, 걔가 각 블록 크기에 맞는 residual을 만들어 내. 그걸 U-Net의 down/mid 출력에 그대로 더하면 — 본체 가중치는 1도 안 건드리고 '형태'만 끌고 갈 수 있어. 사람이 손으로 배선할 필요 없이 StableDiffusionControlNetPipeline이 알아서 controlnet 출력을 unet의 그 인자로 꽂아줘. controlnet_conditioning_scale로 얼마나 세게 따를지만 조절하면 돼.",
    imports: [
      {
        name: "ControlNetModel",
        what: "구조 조건(edge·pose·depth)에서 U-Net 블록용 residual을 만드는 곁가지",
        use: "from_pretrained로 canny 모델 로드, 파이프라인에 controlnet=로 결합",
      },
      {
        name: "StableDiffusionControlNetPipeline",
        what: "SD + ControlNet을 묶어 residual 배선을 자동화한 파이프라인",
        use: "image=조건맵, controlnet_conditioning_scale=강도 로 호출",
      },
      {
        name: "load_image",
        what: "URL/경로에서 PIL 이미지를 불러오는 헬퍼",
        use: "canny edge 조건맵을 읽어 pipe(image=...)에 전달",
      },
    ],
  },
];

export default explanations;
