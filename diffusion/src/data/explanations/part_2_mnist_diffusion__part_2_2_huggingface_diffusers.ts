// Part 2-2 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.
// "Part 2-1에서 맨손으로 짠 걸, 이번엔 HuggingFace diffusers 라이브러리로 갈아끼운다."

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통 펼치기. 앞 노트북이랑 거의 같은 도구인데 이번 주인공은 따로 있어 — 곧 등장할 diffusers야. 스케줄러랑 UNet을 직접 안 짜고 라이브러리에서 꺼내 쓸 거라, 여긴 그 받침 도구들만 미리 깔고 GPU도 잡아둬.",
    imports: [
      {
        name: "torch · torch.nn",
        what: "PyTorch — 텐서 연산과 신경망 기본기",
        use: "MSELoss·AdamW로 학습 루프 돌리고, 입력 텐서 만들고, diffusers 모델을 굴리는 바탕",
      },
      {
        name: "torchvision",
        what: "이미지 데이터셋·변환·시각화 묶음",
        use: "MNIST 받아오기, ToTensor·Normalize 전처리, make_grid로 결과 격자 만들기",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 그래프·이미지 그리기 도구",
        use: "노이즈 섞인 이미지, 생성 결과, 학습 손실 곡선 표시",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "반복문 진행률 표시줄",
        use: "역확산 1000스텝·에폭 진행 상황을 막대로 보여줘",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 계산 라이브러리",
        use: "텐서를 그림으로 옮길 때 잠깐 — 직접 호출은 거의 없어",
      },
      {
        name: "sklearn, seaborn (sns), clear_output, time",
        what: "장난감 데이터·통계그래프·출력제어·시간 유틸",
        use: "Part 1 잔재. add_noise 미리보기에서 clear_output만 살짝, 나머진 곁다리",
      },
    ],
  },
  // 1 — transform + MNIST dataset
  "데이터 전처리 규칙 정하고 MNIST 받아오기. ToTensor로 0~1 만든 뒤 Normalize((0.5,),(0.5,))로 −1~1로 당겨 — 디퓨전 노이즈가 평균 0이라 원본도 0 중심으로 맞춰야 스케일이 어울려. 앞 노트북이랑 똑같은 준비 단계야.",
  // 2 — DataLoader + grid viz
  "DataLoader로 묶음 공급 세팅. 이번엔 batch_size=64로 키웠어 — diffusers UNet이 가벼워서 한 번에 더 많이 먹여도 GPU가 버텨, 그만큼 학습이 빨라져. 한 배치 꺼내 모양(64,1,28,28)과 라벨을 찍고 make_grid로 64장을 격자로 띄워봐.",
  // 3 — DDPMScheduler
  {
    text: "여기서부터 라이브러리가 일한다. 노이즈 일정표를 직접 계산하는 대신 DDPMScheduler 객체 하나를 만들어 — beta 범위(0.00085~0.012)와 'scaled_linear' 방식, 1000스텝을 넘기면 alpha·alpha_bar 같은 계수를 알아서 다 계산해서 들고 있어. scaled_linear는 Stable Diffusion이 쓰는 그 스케줄이고, prediction_type이 'epsilon'이라 '노이즈를 예측'하는 모드, variance_type은 'fixed_small'이야. print로 설정을 펼쳐보면 라이브러리가 뭘 들고 있는지 한눈에 보여. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      3: "이 한 줄이 Part 2-1의 betas·alphas·alpha_bars 손계산을 통째로 대체해 — 인자만 넘기면 객체가 내부에 다 계산해 들고 있어. beta_schedule='scaled_linear'는 beta가 아니라 √beta를 선형으로 깔아 SD가 쓰는 그 방식.",
    },
    diagram: {
      title: "DDPMScheduler — 스케줄을 객체가 대신 관리",
      kind: "architecture",
      summary: `flowchart TD
  CFG["설정: beta 0.00085~0.012<br/>scaled_linear · 1000 steps"] --> S["DDPMScheduler 객체"]
  S --> A["alphas / alpha_bars 자동 계산"]
  S --> M1["add_noise() — forward"]
  S --> M2["step() — reverse 한 스텝"]`,
    },
  },
  // 4 — scheduler.alphas
  "스케줄러가 들고 있는 alpha 배열을 꺼내 확인해. 1−beta 값들이 1에 가깝게 천천히 줄어드는 1000개 텐서야 — 앞 노트북에서 손으로 계산하던 그 alpha를 이젠 라이브러리가 대신 들고 있다는 걸 확인하는 한 줄이야.",
  // 5 — add_noise forward viz
  {
    text: "forward 과정을 라이브러리 함수로 보여줘. 직접 '√ᾱ·x + √(1−ᾱ)·noise' 공식 안 쓰고, scheduler.add_noise(원본, 노이즈, t) 한 줄이면 끝 — 안에서 그 계수를 알아서 곱해줘. t를 0~999 훑으며 10스텝마다 clear_output으로 이전 그림 지우고 새로 띄우면, 숫자가 노이즈로 녹아가는 게 애니메이션처럼 보여.",
    diagram: {
      title: "Forward — add_noise() 한 줄로",
      kind: "algorithm",
      summary: `flowchart TD
  X["원본 배치 x"] --> L["t = 0 … 999"]
  L --> N["noise ~ N(0, I)"]
  N --> AN["x_noised = scheduler.add_noise(x, noise, t)"]
  AN --> C{"t mod 10 == 0 ?"}
  C -->|예| SHOW["clear_output 후 표시"]
  C -->|아니오| L`,
    },
  },
  // 6 — UNet2DModel
  {
    text: "UNet도 손으로 안 짜고 UNet2DModel로 꺼내 조립해. 28×28 입력, 1채널 흑백, 블록당 ResNet 2겹. 블록 출력 채널을 (32,32,64)로 키우는 3단 내리막/오르막인데, 가장 깊은 단만 'Attn~Block'이라 self-attention이 붙어 — 작은 해상도에서 픽셀끼리 전역으로 관계를 보게 하는 거야. 핵심은 class_embed_type='timestep' + num_class_embeds=10 — 숫자 라벨 0~9를 시간 임베딩이랑 같은 방식으로 녹여 조건부 생성을 켜는 스위치야. 앞 노트북에서 class MLP를 직접 더하던 걸 이 옵션 두 개가 대신해. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      9: "내리막 3단의 종류. 앞 둘은 평범한 DownBlock, 가장 깊은 단만 'Attn~'이라 self-attention이 붙어 — 해상도가 작아진 곳에서만 픽셀끼리 전역 관계를 봐(큰 해상도에 attention 깔면 메모리 폭발).",
      11: "오르막은 내리막을 거울처럼 뒤집은 순서 — 깊은 쪽(Attn)부터 풀어 올라와.",
      12: "단별 채널 수 (32,32,64). 깊을수록 채널을 늘려 더 추상적인 특징을 담아.",
      13: "class_embed_type='timestep' — 클래스 라벨을 시간이랑 똑같은 임베딩 방식으로 녹여 넣겠다는 뜻.",
      14: "num_class_embeds=10 — 0~9 열 개 클래스. 이 두 줄이 Part 2-1에서 손으로 더하던 class MLP를 대신해 조건부 생성을 켜.",
    },
    diagram: {
      title: "UNet2DModel 구성 (라이브러리 UNet)",
      kind: "architecture",
      summary: `flowchart TD
  X["노이즈 이미지 (1×28×28)"] --> DN["내리막 3단<br/>32 · 32 · 64ch"]
  T["timestep"] --> EMB["time emb + class emb"]
  CL["class 0~9"] --> EMB
  EMB --> DN
  DN --> MID["UNetMidBlock2D"]
  MID --> UP["오르막 3단 (+ skip)"]
  UP --> O["예측 노이즈 (1×28×28)"]`,
      detail: `flowchart TD
  X["sample (1×28×28)"] --> C0["DownBlock2D 32ch"]
  C0 --> C1["DownBlock2D 32ch"]
  C1 --> C2["AttnDownBlock2D 64ch<br/>self-attention 포함"]
  T["timestep"] --> TE["time embedding (dim 128)"]
  CL["class label"] --> CE["class embed (timestep식, 10개)"]
  TE --> SUM(("time + class 합산"))
  CE --> SUM
  SUM -.주입.-> C0
  C2 --> MID["UNetMidBlock2D"]
  MID --> U0["AttnUpBlock2D + skip"]
  U0 --> U1["UpBlock2D + skip"]
  U1 --> U2["UpBlock2D + skip"]
  U2 --> OUT["output.sample (1×28×28)"]`,
    },
  },
  // 7 — param count
  "모델 파라미터 개수를 세서 찍어봐 — 약 119만 개야. 모든 파라미터의 numel()을 더하는 거고, 이 UNet이 얼마나 '큰지' 감 잡는 용도야. 참고로 진짜 Stable Diffusion UNet은 8억 개가 넘어 — 같은 설계도, 규모만 천 배 차이라는 걸 보여주는 숫자야.",
  // 8 — unet sanity test
  "조립한 UNet에 가짜 입력을 흘려 모양 점검. 랜덤 이미지 5장·t 5개·클래스 5개를 넣고 .sample로 출력을 꺼내 — 여기서 중요한 차이: 라이브러리 모델은 텐서를 바로 안 주고 출력 객체로 감싸 돌려줘서 .sample을 붙여야 진짜 텐서가 나와. 모양이 (5,1,28,28)이면 통과야.",
  // 9 — torchinfo summary
  "모델 속을 X-ray로 들여다봐. torchinfo.summary에 입력을 튜플로 묶어 넣으면 층마다 입력·출력 모양, 파라미터 수, 곱셈량까지 표로 쫙 뽑아줘. ResnetBlock·Attention·Downsample이 어떻게 쌓여 119만 파라미터가 되는지, UNet 내부가 실제로 어떻게 생겼는지 뜯어보는 디버깅·이해용이야.",
  // 10 — generate_image() def (scheduler.step)
  {
    text: "샘플 생성 함수를 미리 정의해둬. 0~9 라벨 박고 순수 노이즈 10장에서 시작하는데, 역확산 수식을 직접 안 써 — scheduler.timesteps를 따라 돌며 매 스텝 UNet으로 노이즈를 예측(.sample)하고 scheduler.step(예측, t, x_t).prev_sample 한 줄에 디노이즈를 통째로 맡겨. 앞 노트북에서 μ_θ·√β_t를 손으로 계산하던 그 한 단계를 step()이 알아서 처리해주는 거야.",
    diagram: {
      title: "샘플링 — scheduler.step()에 맡기기",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 x_T (라벨 0~9)"] --> B["t in scheduler.timesteps"]
  B --> C["noise_pred = unet(x_t, t, y).sample"]
  C --> D["x_t = scheduler.step(noise_pred, t, x_t).prev_sample"]
  D --> B
  B --> E["완성 숫자 격자 표시"]`,
    },
  },
  // 11 — generate_image() call (untrained)
  "방금 만든 함수를 학습 전에 한 번 돌려봐. 모델이 아직 백지라 결과는 의미 없는 얼룩이 나올 거야 — 일부러 '학습 전엔 이렇게 엉망'이라는 출발선을 찍어두고, 나중 결과랑 비교하려는 거야. (config 직접 접근 deprecation 경고는 떠도 동작엔 지장 없어.)",
  // 12 — training loop
  {
    text: "본 게임 — 10에폭 학습. MSE + AdamW(lr=1e-3)로, 배치마다: 노이즈 뽑고 랜덤 t 골라 add_noise로 더럽힌 다음, UNet에 라벨까지 줘서 노이즈를 예측(.sample), 진짜 노이즈와의 MSE로 backward·step. 앞 노트북이랑 뼈대는 똑같은데 손계산이 전부 라이브러리 호출로 바뀐 게 포인트야. 매 에폭 generate_image로 숫자가 또렷해지는 걸 보고, 최근 100개 손실 평균을 찍어 진척을 확인해. 실전 응용 한 입 — 바로 이 'UNet2DModel + DDPMScheduler + add_noise/step' 조합이 diffusers 생태계의 표준 레시피라, 여기서 데이터를 셀럽 얼굴·풍경·의료 영상으로 바꾸고 모델만 키우면 그대로 제품용 생성 파이프라인이 돼. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      22: "배치 안 각 이미지마다 0~998 사이 무작위 t. .long()은 정수 타입 — 인덱스로 쓰려면 정수여야 해.",
      23: "scheduler.add_noise 한 줄이 Part 2-1의 '√ᾱ·x + √(1−ᾱ)·noise' 손계산을 대체 — 라이브러리가 알아서 그 t의 계수를 곱해.",
      26: "라이브러리 모델은 텐서를 바로 안 주고 출력 객체로 감싸 — .sample을 붙여야 진짜 예측 노이즈 텐서가 나와.",
      29: "예측 노이즈 vs 진짜 노이즈의 MSE. 손계산이든 라이브러리든 학습 목표는 똑같아.",
      32: "zero_grad로 먼저 기울기 비우고(누적 방지),",
      34: "step으로 한 발 갱신. backward→step 순서만 지키면 zero_grad 위치는 자유로워.",
    },
    diagram: {
      title: "학습 루프 (diffusers 버전)",
      kind: "algorithm",
      summary: `flowchart TD
  S["MSE + AdamW(1e-3) · 10 에폭"] --> B["배치 반복"]
  B --> N["noise + 랜덤 timesteps"]
  N --> AN["noisy_x = scheduler.add_noise(...)"]
  AN --> P["pred = unet(noisy_x, t, y).sample"]
  P --> L["MSE(pred, noise) → backward → step"]
  L --> B
  B --> G["에폭마다 generate_image() + 손실 평균"]`,
      detail: `flowchart TD
  EP["epoch 0..9"] --> BATCH["for x, y in dataloader"]
  BATCH --> NS["noise ~ N(0, I)"]
  NS --> TS["timesteps ~ randint(0, 999)"]
  TS --> AN["noisy_x = scheduler.add_noise(x, noise, timesteps)"]
  AN --> PR["pred = unet(noisy_x, timesteps, y).sample"]
  PR --> LS["loss = MSE(pred, noise)"]
  LS --> OP["opt.zero_grad(); backward(); opt.step()"]
  OP --> REC["losses.append(loss)"]
  REC --> BATCH
  EP --> GEN["generate_image()"]
  GEN --> AVG["최근 100 손실 평균 출력"]`,
    },
  },
  // 13 — final class-grid sampling
  "마무리로 큰 격자를 뽑아 모델 실력을 자랑해. 노이즈 80장에 라벨을 [0,0,...,1,1,...,9,9] 식으로 각 숫자당 8장씩 박고 전체 역확산을 돌려 — 같은 클래스끼리 한 줄로 모인 10×8 격자가 나와. 조건부 생성이 제대로 됐다면 '0 줄엔 0만, 9 줄엔 9만' 나오는지로 한눈에 검증되는 거야.",
];

export default explanations;
