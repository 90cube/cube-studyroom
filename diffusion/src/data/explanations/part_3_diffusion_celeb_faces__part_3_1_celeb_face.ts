// Part 3-1 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.
// "MNIST를 졸업하고, 진짜 컬러 얼굴(64×64 RGB)을 성별 조건으로 생성한다."

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통 펼치기. 이번엔 흑백 숫자가 아니라 컬러 얼굴 사진이 상대라 난도가 확 올라가 — 채널이 3개고 해상도도 64×64로 커져. 도구는 앞 노트북들이랑 같고, 곧 등장할 diffusers와 HuggingFace datasets가 주인공이야. 먼저 GPU부터 잡아둬.",
    imports: [
      {
        name: "torch · torch.nn",
        what: "PyTorch — 텐서 연산과 신경망 기본기",
        use: "MSELoss·AdamW 학습 루프, 입력 텐서 생성, diffusers UNet 구동의 바탕",
      },
      {
        name: "torchvision",
        what: "이미지 변환·시각화 묶음",
        use: "transforms로 얼굴 Resize·ToTensor·Normalize, make_grid로 배치를 격자 이미지로",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 이미지·그래프 그리기 도구",
        use: "원본 얼굴, 노이즈 섞인 얼굴, 생성된 얼굴 표시",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "반복문 진행률 표시줄",
        use: "DDIM 50스텝 샘플링·5만 스텝 학습 진행을 막대로 보여줘",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 계산 라이브러리",
        use: "텐서를 그림으로 옮길 때 잠깐 — 직접 호출은 거의 없어",
      },
      {
        name: "sklearn, seaborn (sns), clear_output, time",
        what: "장난감 데이터·통계그래프·출력제어·시간 유틸",
        use: "Part 1 잔재. 미리보기에서 clear_output만 살짝, 나머진 곁다리",
      },
    ],
  },
  // 1 — load_dataset (HF) + filter
  {
    text: "데이터를 HuggingFace 허브에서 바로 끌어와. datasets의 load_dataset으로 'ashraq/tmdb-celeb-10k'(영화 셀럽 얼굴) 학습 split을 받고, 연습이니까 select(range(1000))로 1000장만 떼. 그다음 filter로 gender가 1(여)/2(남)인 것만 남겨 — 성별 라벨이 없거나 0인 건 빼서, 곧 만들 조건부 생성의 깔끔한 라벨로 쓰려는 거야.",
    diagram: {
      title: "데이터 적재 파이프라인",
      kind: "algorithm",
      summary: `flowchart TD
  H["HF Hub: ashraq/tmdb-celeb-10k"] --> L["load_dataset(split='train')"]
  L --> S["select(range(1000)) — 1000장만"]
  S --> F["filter: gender in [1, 2]"]
  F --> D["학습용 얼굴 데이터셋"]`,
    },
  },
  // 2 — show one image + print record
  "데이터셋 한 칸(idx=100)을 꺼내 얼굴을 띄우고 메타데이터도 통째로 찍어봐. PIL 이미지가 그대로 들어있고, 옆에 이름·생일·gender 같은 정보가 딸려 와 — 우리가 복원해낼 '진짜 얼굴'이 어떻게 생겼고 라벨(gender)이 어떻게 붙어 있는지 눈으로 확인하는 한 칸이야.",
  // 3 — transform def + with_transform
  {
    text: "얼굴 전처리 규칙을 짜고 데이터셋에 매달아. 64×64로 Resize → ToTensor(0~1) → Normalize([0.5],[0.5])로 −1~1로 당겨 — 디퓨전 노이즈가 평균 0이라 픽셀도 0 중심으로 맞추는 거야. 모든 이미지를 .convert('RGB')로 강제해 흑백·투명 섞여도 3채널로 통일하고. with_transform으로 걸어두면 배치를 꺼낼 때 그때그때(lazy) 변환돼서, 1000장을 메모리에 미리 다 풀어둘 필요가 없어 — 메모리 절약 트릭이야.",
    diagram: {
      title: "이미지 transform (lazy)",
      kind: "algorithm",
      summary: `flowchart TD
  I["원본 PIL 얼굴"] --> R["Resize 64×64"]
  R --> RGB["convert('RGB') — 3채널 통일"]
  RGB --> T["ToTensor (0~1)"]
  T --> N["Normalize → −1~1"]
  N --> P["pixel_values (3×64×64)"]`,
    },
  },
  // 4 — collate_fn + DataLoader
  {
    text: "배치를 어떻게 묶을지 collate_fn으로 직접 정하고 DataLoader를 만들어. 샘플마다 pixel_values를 모아 torch.stack으로 한 텐서로 쌓고, gender 라벨은 long으로 바꾼 뒤 −1을 빼 — 데이터의 1/2를 모델이 좋아하는 0/1로 옮기는 거야(클래스 인덱스는 0부터 시작해야 임베딩 테이블이 깔끔해). batch_size=4로 작게 잡았는데, 64×64 컬러 + 커진 UNet이라 GPU 메모리가 빡빡해서 그래. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      11: "낱장 텐서 리스트를 torch.stack으로 (4,3,64,64) 한 덩어리로 쌓아 — 모델은 배치 단위로 먹어야 빨라.",
      12: "gender 1/2를 long()−1로 0/1로 옮겨. 임베딩 테이블은 인덱스 0부터 채우니까, 라벨도 0부터 시작해야 첫 칸이 안 비고 깔끔해.",
      15: "batch_size=4 — 64×64 컬러에 커진 UNet이라 GPU 메모리가 빡빡해서 일부러 작게.",
    },
    diagram: {
      title: "collate_fn — 배치 조립",
      kind: "algorithm",
      summary: `flowchart TD
  EX["샘플 리스트"] --> IMG["pixel_values 모으기"]
  IMG --> ST["torch.stack → (B, 3, 64, 64)"]
  EX --> LAB["gender 모으기"]
  LAB --> SHIFT["long() − 1 → 0/1"]
  ST --> OUT["batch: pixel_values + label"]
  SHIFT --> OUT`,
    },
  },
  // 5 — batch viz (break)
  "DataLoader가 진짜로 도는지 한 배치만 꺼내 확인해. pixel_values 모양(4,3,64,64)을 찍고, make_grid로 얼굴 4장을 격자로 띄운 뒤 라벨(0/1)도 출력해 — break로 첫 배치만 보고 바로 멈춰, 빠른 점검용이야. *0.5+0.5로 −1~1을 다시 0~1 보기 좋은 범위로 되돌리는 것 잊지 말고.",
  // 6 — DDPMScheduler
  {
    text: "노이즈 일정표는 또 라이브러리에 맡겨 — DDPMScheduler를 beta 0.00085~0.012, scaled_linear, 1000스텝으로 만들어. Part 2-2랑 똑같은 설정이야. scaled_linear는 Stable Diffusion이 쓰는 그 스케줄이고 prediction_type='epsilon'(노이즈 예측 모드). 얼굴이든 숫자든 forward 과정의 노이즈 규칙은 데이터랑 무관하게 같다는 게 포인트야.",
    diagram: {
      title: "DDPMScheduler (학습용 forward 스케줄)",
      kind: "architecture",
      summary: `flowchart TD
  CFG["beta 0.00085~0.012<br/>scaled_linear · 1000 steps"] --> S["DDPMScheduler"]
  S --> AN["add_noise() — 학습 때 forward"]
  S --> CF["config → 나중에 DDIM이 물려받음"]`,
    },
  },
  // 7 — add_noise forward viz
  {
    text: "얼굴이 노이즈로 녹는 과정을 보여줘. 아까 그 배치를 가져다 t를 0~999 훑으며 scheduler.add_noise(원본, 노이즈, t) 한 줄로 t단계 이미지를 만들고, 10스텝마다 clear_output으로 갈아끼우며 띄워 — 또렷한 얼굴이 점점 흐려지다 완전한 컬러 노이즈가 되는 게 보여. 숫자 때랑 똑같은 원리인데 대상이 진짜 얼굴이라 더 실감 나.",
    diagram: {
      title: "Forward — 얼굴 → 노이즈",
      kind: "algorithm",
      summary: `flowchart TD
  X["얼굴 배치 x"] --> L["t = 0 … 999"]
  L --> N["noise ~ N(0, I)"]
  N --> AN["x_noised = scheduler.add_noise(x, noise, t)"]
  AN --> C{"t mod 10 == 0 ?"}
  C -->|예| SHOW["clear_output 후 표시"]
  C -->|아니오| L`,
    },
  },
  // 8 — UNet2DModel (bigger, 64x64 RGB)
  {
    text: "얼굴용 UNet을 UNet2DModel로 조립해 — 숫자 때보다 훨씬 무거워. 64×64 입력, in/out 3채널(RGB), 블록당 ResNet 2겹. 채널을 (64,128,160,224)로 4단까지 키우고, 첫 단 빼고 나머지 셋 다 'Attn~Block'이라 self-attention을 넉넉히 깔았어 — 얼굴은 눈·코·입의 전역 배치(좌우 대칭 같은)가 중요해서 attention이 그 장거리 관계를 잡아줘. num_class_embeds=2로 성별 0/1 조건을 켜고. (class_embed_type을 안 줘서 기본 학습형 임베딩으로 라벨이 들어가.) 그래서 파라미터가 1700만대로 확 불어. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      5: "in_channels=3 — 흑백 숫자(1채널)와 달리 RGB 컬러라 입력 3채널. out도 3채널(컬러 노이즈 예측).",
      9: "내리막 4단. Part 2-2는 가장 깊은 1단만 attention이었는데, 얼굴은 첫 단 빼고 3단이나 Attn — 눈·코·입의 좌우 대칭 같은 장거리 관계를 잡으려면 attention이 더 필요해.",
      12: "채널 (64,128,160,224) — 숫자 때 (32,32,64)보다 훨씬 두꺼워. 복잡한 얼굴 분포를 담으려면 표현력이 더 들어.",
      13: "num_class_embeds=2 — 성별 0/1 두 클래스. class_embed_type을 안 줬으니 기본 학습형 임베딩으로 라벨이 들어가.",
    },
    diagram: {
      title: "UNet2DModel (얼굴용, 4단 + attention)",
      kind: "architecture",
      summary: `flowchart TD
  X["노이즈 얼굴 (3×64×64)"] --> DN["내리막 4단<br/>64·128·160·224ch"]
  T["timestep"] --> EMB["time emb + 성별 emb"]
  G["gender 0/1"] --> EMB
  EMB --> DN
  DN --> MID["UNetMidBlock2D"]
  MID --> UP["오르막 4단 (+ skip)"]
  UP --> O["예측 노이즈 (3×64×64)"]`,
      detail: `flowchart TD
  X["sample (3×64×64)"] --> D0["DownBlock2D 64ch"]
  D0 --> D1["AttnDownBlock2D 128ch"]
  D1 --> D2["AttnDownBlock2D 160ch"]
  D2 --> D3["AttnDownBlock2D 224ch"]
  T["timestep"] --> TE["time embedding"]
  G["gender label"] --> CE["class embed (2개)"]
  TE --> SUM(("time + class 합산"))
  CE --> SUM
  SUM -.주입.-> D0
  D3 --> MID["UNetMidBlock2D"]
  MID --> U0["AttnUpBlock2D + skip"]
  U0 --> U1["AttnUpBlock2D + skip"]
  U1 --> U2["AttnUpBlock2D + skip"]
  U2 --> U3["UpBlock2D + skip"]
  U3 --> OUT["output.sample (3×64×64)"]`,
    },
  },
  // 9 — param count
  "모델 파라미터 개수를 세서 찍어봐 — 약 1764만 개야. Part 2-2의 119만에서 15배쯤 커졌지. 채널을 키우고 attention을 여러 단 깐 대가야. 얼굴처럼 복잡한 분포를 배우려면 표현력(=파라미터)이 더 필요하다는 걸 숫자로 보여주는 셈이야.",
  // 10 — unet sanity test
  "조립한 UNet에 가짜 입력을 흘려 점검. 랜덤 이미지 5장·t 5개·성별 라벨 5개를 넣고 한 번 통과시켜 봐 — 에러 없이 forward가 끝나면 배선이 맞은 거야. (여기 테스트 입력은 128×128로 줬는데, UNet2DModel은 채널 배수만 맞으면 해상도엔 유연해서 통과해. 실제 학습은 64×64로 돌아가.)",
  // 11 — generate_image() def (DDIM, fast)
  {
    text: "샘플 생성 함수를 정의하는데, 여기서 영리한 전환이 일어나 — 학습은 DDPM 1000스텝으로 했지만 생성은 DDIMScheduler로 갈아타. DDIMScheduler.from_config(scheduler.config)로 학습 스케줄의 설정을 그대로 물려받되, set_timesteps(50)으로 1000단계를 50단계로 확 줄여. DDIM은 매 스텝 무작위 노이즈를 안 더하는 결정론적 방식이라, 스텝을 건너뛰어도 품질이 별로 안 깨져 — 그래서 20배 빠르게 얼굴을 뽑을 수 있어. 성별 라벨 [0,0,1,1]을 줘서 조건부로 4장 생성해. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      7: "from_config로 학습용 DDPM의 beta·스케줄 설정을 그대로 물려받아 DDIM을 만들어 — 학습과 생성의 노이즈 규칙이 어긋나면 안 되니까.",
      8: "set_timesteps(50)으로 1000단계를 50으로 압축. DDIM은 결정론적이라 이렇게 건너뛰어도 품질이 별로 안 깨져 → 20배 빠름.",
      14: "매 스텝 UNet으로 노이즈 예측. 라벨을 같이 줘서 성별 조건을 반영. .sample로 텐서 꺼내.",
      17: "inf_scheduler.step(...).prev_sample 한 줄이 DDIM 역확산 한 칸 — μ 계산·노이즈 제거를 통째로 맡겨.",
    },
    diagram: {
      title: "DDIM 샘플링 (학습 1000 → 생성 50스텝)",
      kind: "algorithm",
      summary: `flowchart TD
  CFG["scheduler.config 물려받기"] --> DI["DDIMScheduler.from_config"]
  DI --> ST["set_timesteps(50)"]
  ST --> A["순수 노이즈 4장 (성별 0,0,1,1)"]
  A --> B["t in 50 timesteps"]
  B --> C["noise_pred = unet(x_t, t, label).sample"]
  C --> D["x_t = inf_scheduler.step(...).prev_sample"]
  D --> B
  B --> E["완성 얼굴 4장 표시"]`,
    },
  },
  // 12 — generate_image() call (untrained)
  "학습 전에 한 번 돌려 출발선을 찍어. 모델이 백지라 컬러 얼룩만 나올 거야 — '아직 아무것도 못 배운 상태'를 기록해두고, 학습 뒤 결과랑 대조하려는 거야. DDIM이라 50스텝이라 그래도 금방 끝나.",
  // 13 — training loop (step budget, 50k)
  {
    text: "본 게임 — 5만 스텝 학습. 에폭 수가 아니라 'num_steps < 50000'으로 도는 게 포인트야. batch_size=4로 작게 먹이는 대신 스텝을 아주 많이 밟아 누적으로 학습량을 채우는 전략 — 작은 GPU로 얼굴 같은 무거운 데이터를 학습할 때 흔히 쓰는 방식이야(큰 배치 한 방 대신 작은 배치 다발). MSE+AdamW(1e-3)로 매 배치: 노이즈·랜덤 t로 더럽히고, UNet에 성별 라벨까지 줘 노이즈 예측(.sample), MSE로 backward·step. 500스텝마다 손실 평균을 찍고 DDIM으로 얼굴을 생성해 진척을 봐. (셀 끝의 KeyboardInterrupt는 5만 스텝이 오래 걸려 중간에 손으로 멈춘 흔적이야 — 에러 아님.) 실전 응용으로 보면 이 구조가 바로 '내 데이터셋으로 처음부터 도메인 특화 생성 모델 만들기'의 표준 틀이야 — 얼굴 대신 제품 사진·패션·캐릭터 아트를 넣고 라벨만 바꾸면, 조건부로 원하는 카테고리를 뽑아내는 맞춤 생성기가 돼. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      14: "에폭이 아니라 'num_steps < 50000'으로 도는 게 핵심 — 작은 배치(4)로 적게 먹이는 대신 스텝을 잔뜩 밟아 학습량을 채워. dataloader를 다 돌아도 5만이 안 차면 처음부터 다시 돌아.",
      22: "scheduler.add_noise로 원본을 랜덤 t만큼 한 방에 더럽혀 x_noised를 만들어 (forward).",
      25: "UNet에 노이즈 이미지·t·성별 라벨까지 줘서 노이즈 예측. .sample로 텐서 꺼내.",
      35: "매 배치 num_steps를 1씩 올려 — 이 값이 5만에 닿으면 while이 끝나. 진행도의 기준이야.",
    },
    diagram: {
      title: "학습 루프 (스텝 예산 5만)",
      kind: "algorithm",
      summary: `flowchart TD
  S["MSE + AdamW(1e-3)"] --> W{"num_steps < 50000 ?"}
  W -->|예| B["배치 반복 (batch=4)"]
  B --> N["noise + 랜덤 timesteps"]
  N --> AN["noisy_x = scheduler.add_noise(...)"]
  AN --> P["pred = unet(noisy_x, t, y).sample"]
  P --> L["MSE(pred, noise) → backward → step"]
  L --> CK{"num_steps mod 500 == 0 ?"}
  CK -->|예| G["손실 평균 + DDIM 생성"]
  CK -->|아니오| W
  G --> W
  W -->|아니오| DONE["학습 종료"]`,
      detail: `flowchart TD
  W{"num_steps < 50000 ?"} -->|예| BATCH["for batch in dataloader"]
  BATCH --> XY["x = pixel_values, y = label"]
  XY --> NS["noise ~ N(0, I)"]
  NS --> TS["timesteps ~ randint(0, 999)"]
  TS --> AN["noisy_x = scheduler.add_noise(x, noise, timesteps)"]
  AN --> PR["pred = unet(noisy_x, timesteps, y).sample"]
  PR --> LS["loss = MSE(pred, noise)"]
  LS --> OP["opt.zero_grad(); backward(); opt.step()"]
  OP --> INC["num_steps += 1; losses.append(loss)"]
  INC --> CK{"num_steps mod 500 == 0 ?"}
  CK -->|예| GEN["손실 평균 출력 + generate_image() (DDIM)"]
  CK -->|아니오| BATCH
  GEN --> BATCH`,
    },
  },
];

export default explanations;
