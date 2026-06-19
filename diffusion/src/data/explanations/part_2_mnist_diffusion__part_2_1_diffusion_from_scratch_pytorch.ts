// Part 2-1 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.
// "맨바닥 PyTorch로 DDPM을 직접 짜서 MNIST 손글씨를 생성한다."

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통부터 펼쳐 — 이번엔 2D 장난감 점이 아니라 진짜 이미지(MNIST 숫자)를 다룰 거야. 마지막 줄에서 GPU 있으면 GPU 쓰라고 장치부터 정해두고 시작해. 라이브러리별 역할은 아래 정리해놨어.",
    imports: [
      {
        name: "torch · torch.nn · F",
        what: "PyTorch — 텐서 연산과 신경망 빌딩블록",
        use: "노이즈 일정표 계산(linspace·cumprod), UNet 정의(Conv2d·GroupNorm·SiLU), 학습 루프, 샘플링까지 거의 전부",
      },
      {
        name: "torchvision",
        what: "이미지용 데이터셋·변환·시각화 묶음",
        use: "MNIST 데이터셋 다운로드, ToTensor·Normalize 전처리, make_grid로 배치를 격자 이미지로 묶기",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 그래프·이미지 그리기 도구",
        use: "숫자 이미지(imshow), alpha_bar 곡선, forward 과정이 망가지는 모습 전부 얘로 그려",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "반복문 진행률 표시줄",
        use: "에폭·역확산 1000스텝이 지금 어디까지 갔는지 막대로 보여줘",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 계산 라이브러리",
        use: "텐서를 그림으로 옮길 때 .numpy()로 잠깐, 직접 호출은 거의 없어",
      },
      {
        name: "sklearn, seaborn (sns), clear_output, time",
        what: "장난감 데이터·통계그래프·출력제어·시간 유틸",
        use: "Part 1에서 쓰던 잔재들 — 이 노트북에선 거의 안 써. 맨 뒤 곁다리야",
      },
    ],
  },
  // 1 — transform + MNIST dataset
  "데이터 전처리 규칙을 정하고 MNIST를 받아와. ToTensor로 0~1 텐서로 바꾼 다음 Normalize((0.5,),(0.5,))로 −1~1 범위로 당겨 — 디퓨전은 노이즈가 평균 0 정규분포라서, 원본도 0을 중심으로 펴줘야 노이즈랑 스케일이 맞아. 그래야 학습이 안정돼.",
  // 2 — dataset[0]
  "데이터셋 첫 칸을 그냥 꺼내서 뭐가 들었나 확인해. (이미지 텐서, 라벨) 한 쌍이 나와 — 픽셀이 −1~1로 잘 정규화됐는지, 라벨이 정수인지 눈으로 점검하는 한 줄이야.",
  // 3 — plt.imshow(dataset[0][0])
  "그 첫 이미지를 실제로 띄워봐. squeeze로 (1,28,28)의 채널 축을 떼고 28×28 흑백으로 보여줘 — 우리가 앞으로 노이즈에서 복원해낼 '정답 숫자'가 어떻게 생겼는지 직접 보는 거야.",
  // 4 — DataLoader + grid viz
  "낱장 말고 묶음으로 먹이게 DataLoader로 감싸. batch_size=8에 매 에폭 섞고(shuffle), 한 배치 꺼내서 모양(8,1,28,28)과 라벨을 찍어봐. make_grid로 8장을 한 줄 격자로 붙여 보여주는데, *0.5+0.5는 −1~1을 다시 0~1 보기 좋은 범위로 되돌리는 거야.",
  // 5 — schedule (betas, alphas, alpha_bars) + plot
  {
    text: "노이즈 일정표를 짜. 1000단계 동안 매 단계 얼마나 노이즈를 섞을지(beta)를 아주 작은 값에서 0.01까지 선형으로 깔고, alpha=1−beta, 거기서 '누적 곱 alpha_bar'를 구해. 이 alpha_bar 하나면 0단계 원본에서 임의의 t단계 노이즈 이미지로 한 방에 점프할 수 있어 — 매 단계 일일이 노이즈 안 더해도 되는 게 DDPM의 핵심 트릭이야. 곡선을 그려보면 1에서 0으로 미끄러지며 원본이 사라지는 게 보여.",
    diagram: {
      title: "노이즈 스케줄 (forward 계수)",
      kind: "algorithm",
      summary: `flowchart TD
  B["beta: 1e-4 → 0.01 선형 1000개"] --> A["alpha = 1 − beta"]
  A --> AB["alpha_bar = 누적곱(alpha)"]
  AB --> P["곡선 그리기: 1 → 0 감소"]`,
    },
  },
  // 6 — forward diffusion loop (one-shot per t)
  {
    text: "원본이 망가지는 과정을 눈으로 보여줘. 한 배치를 GPU에 올리고 t를 0→999까지 훑되, 매 t마다 새 노이즈를 뽑아서 'x_t = √ᾱ_t·원본 + √(1−ᾱ_t)·노이즈' 공식으로 한 방에 t단계 이미지를 만들어. 50스텝마다 한 장씩 띄우면, 숫자가 점점 흐려지다 결국 완전한 노이즈 구름이 되는 게 바로 forward process야.",
    diagram: {
      title: "Forward diffusion (원본 → 노이즈)",
      kind: "algorithm",
      summary: `flowchart TD
  X0["원본 배치 x"] --> L["t = 0 … 999 반복"]
  L --> N["noise ~ N(0, I)"]
  N --> XT["x_t = √ᾱ_t·x + √(1−ᾱ_t)·noise"]
  XT --> C{"t mod 50 == 0 ?"}
  C -->|예| SHOW["격자 이미지로 표시"]
  C -->|아니오| L`,
    },
  },
  // 7 — MyUNet class
  {
    text: "노이즈를 걷어낼 UNet을 맨손으로 설계해. 가운데로 갈수록 해상도를 절반씩 줄이며(MaxPool) 특징을 압축하는 내리막(down) 3층, 다시 2배씩 키우며(Upsample) 복원하는 오르막(up) 3층 구조야. 핵심은 두 가지 — (1) 내리막에서 뽑은 특징을 같은 해상도 오르막에 더해주는 skip 연결(h.pop), 이게 디테일을 살려. (2) '지금 몇 단계인지(t)'와 '어떤 숫자인지(cls)'를 각각 작은 MLP로 임베딩해서 첫 블록 특징맵에 더해줘 — 모델이 시간 감각과 클래스를 동시에 갖게 하는 거야. 출력은 입력과 똑같은 28×28, 즉 '이 이미지에 낀 노이즈'의 예측이야.",
    diagram: {
      title: "MyUNet 구조 (down → up + skip)",
      kind: "architecture",
      summary: `flowchart TD
  X["노이즈 낀 이미지 x_t"] --> D["내리막 3층<br/>해상도 ÷2, 채널 ↑"]
  T["timestep t"] --> EMB["t·cls 임베딩"]
  C["class cls"] --> EMB
  EMB --> D
  D --> U["오르막 3층<br/>해상도 ×2, skip 합치기"]
  U --> O["예측: 낀 노이즈 (28×28)"]`,
      detail: `flowchart TD
  X["x_t (1×28×28)"] --> D0["down0: Conv 1→32 · GN · SiLU"]
  T["t"] --> TE["time MLP → 32"]
  CL["cls"] --> CE["class MLP → 32"]
  D0 --> ADD(("+ t_emb + cls_emb"))
  TE --> ADD
  CE --> ADD
  ADD --> H0["skip h0 저장"] --> MP0["MaxPool ÷2"]
  MP0 --> D1["down1: Conv 32→64 · GN · SiLU"] --> H1["skip h1 저장"] --> MP1["MaxPool ÷2"]
  MP1 --> D2["down2: Conv 64→64 · GN · SiLU"]
  D2 --> U0["up0: Conv 64→64 · GN · SiLU"]
  U0 --> US1["Upsample ×2"] --> P1(("+ h1"))
  P1 --> U1["up1: Conv 64→32 · GN · SiLU"]
  U1 --> US2["Upsample ×2"] --> P2(("+ h0"))
  P2 --> U2["up2: Conv 32→1 (출력)"]
  U2 --> Y["예측 노이즈 (1×28×28)"]`,
    },
  },
  // 8 — unet sanity test
  "방금 만든 UNet에 가짜 입력을 한 번 흘려서 모양만 확인해. 랜덤 이미지 5장, 0~999 사이 t 5개, 클래스 5개를 넣고 출력이 입력과 똑같은 (5,1,28,28)로 나오면 배선이 맞은 거야 — 학습 들어가기 전 필수 점검이야.",
  // 9 — generate_image() def (DDPM reverse, manual)
  {
    text: "학습 중간중간 실력을 눈으로 볼 함수를 미리 정의해둬. 0~9 라벨을 박아 순수 노이즈 10장에서 시작하고, t를 999→0으로 거꾸로 내려오며 매 단계 UNet이 '낀 노이즈'를 예측하면 DDPM 역확산 공식으로 그만큼만 살짝 걷어내. t>0이면 약간의 새 노이즈를 다시 섞고(분산 √β_t), t=0에선 깔끔하게 평균만 남겨. (참고로 본문 그대로면 step 변수가 학습 루프 거 — 학습 중 호출 전제라 거기 정의된 step을 끌어다 써.)",
    diagram: {
      title: "DDPM 샘플링 (역확산, 수식 직접 구현)",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 x_T (10장, 라벨 0~9)"] --> B["t = T−1 … 0 반복"]
  B --> C["UNet으로 노이즈 예측"]
  C --> D["μ_θ 계산 (한 스텝 디노이즈)"]
  D --> E{"t > 0 ?"}
  E -->|예| Z["x = μ_θ + √β_t · z"]
  E -->|아니오| X0["x = μ_θ (노이즈 없음)"]
  Z --> B
  X0 --> DONE["완성 숫자 격자 표시"]`,
      detail: `flowchart TD
  A["x_T ~ N(0, I), y = 0..9"] --> B["t: 999 → 0"]
  B --> EPS["eps = unet(x_t, t, y)"]
  EPS --> C1["coef1 = 1/√α_t"]
  C1 --> C2["coef2 = β_t/√(1−ᾱ_t)"]
  C2 --> MU["μ_θ = coef1·(x_t − coef2·eps)"]
  MU --> E{"t > 0 ?"}
  E -->|예| Z["z ~ N(0,I)<br/>x = μ_θ + √β_t · z"]
  E -->|아니오| X0["x = μ_θ"]
  Z --> B
  X0 --> SHOW["make_grid로 표시"]`,
    },
  },
  // 10 — training loop
  {
    text: "이제 본 게임 — 모델을 훈련시켜. 손실은 MSE, 옵티마이저는 AdamW(lr=5e-4). 50에폭 동안 배치마다: 원본에 무작위 t를 골라 노이즈를 한 방에 섞고(x_noised), UNet한테 라벨까지 같이 주며 '여기 낀 노이즈 맞혀봐' 시킨 뒤, 진짜 노이즈와 얼마나 틀렸는지 재서 backward로 모델을 조금씩 고쳐. zero_grad로 기울기 초기화하는 것 잊지 말고. 5에폭마다 generate_image로 숫자가 점점 또렷해지는 걸 확인해. 실전 응용으로 보면 이게 Stable Diffusion·DALL·E 같은 생성 모델의 학습 심장부랑 똑같은 구조야 — 규모(데이터·파라미터·해상도)만 키운 거지 원리는 이 루프 그대로야.",
    diagram: {
      title: "학습 루프 (노이즈 예측 학습)",
      kind: "algorithm",
      summary: `flowchart TD
  S["MSE + AdamW(5e-4)"] --> EP["50 에폭 · 배치 반복"]
  EP --> T["랜덤 t로 x_noised 생성"]
  T --> P["UNet이 노이즈 예측 (라벨 포함)"]
  P --> L["MSE(예측, 진짜 노이즈)"]
  L --> U["backward + step + zero_grad"]
  U --> EP
  EP --> G["5에폭마다 generate_image()"]`,
      detail: `flowchart TD
  EP["epoch 0..49"] --> BATCH["for x, y in dataloader"]
  BATCH --> RT["t ~ randint(0, T)"]
  RT --> NS["noise ~ N(0, I)"]
  NS --> XN["x_noised = √ᾱ_t·x + √(1−ᾱ_t)·noise"]
  XN --> PR["pred = unet(x_noised, t, y)"]
  PR --> LS["loss = MSE(pred, noise)"]
  LS --> BW["loss.backward()"]
  BW --> OP["optimizer.step(); zero_grad()"]
  OP --> BATCH
  EP --> CK{"epoch mod 5 == 0 ?"}
  CK -->|예| GEN["generate_image()"]`,
    },
  },
  // 11 — x_t1.max(), x_t1.min()
  "마지막 forward 결과의 최댓값·최솟값을 슬쩍 찍어봐. 완전히 노이즈가 된 이미지라 −1~1을 한참 벗어난 ±3~4쯤 나올 거야 — 순수 가우시안 노이즈가 정규분포라 그래. (그래서 imshow가 '범위 넘었다'고 클리핑 경고를 뱉은 거고.) 데이터가 의도대로 망가졌는지 확인하는 디버깅용 한 줄이야.",
];

export default explanations;
