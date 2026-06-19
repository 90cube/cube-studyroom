// Part 1 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports
  {
    text: "먼저 연장통부터 펼쳐 — 앞으로 쓸 도구들을 미리 다 꺼내놓는 단계야. 각각 뭐고 이 노트북에서 어디 쓰일지는 아래에 정리해놨어.",
    // 라이브러리는 노트북에서 실제로 쓰이는 순서대로 나열한다.
    imports: [
      {
        name: "sklearn.datasets",
        what: "연습용 장난감 데이터셋 생성기",
        use: "맨 처음 sample_data에서 make_circles·make_blobs로 학습용 2D 점부터 만들어",
      },
      {
        name: "torch · torch.nn · F",
        what: "PyTorch — 텐서 연산과 신경망 빌딩블록",
        use: "만든 데이터를 텐서로 바꾸고, 노이즈 텐서 생성(randn_like), Model(신경망) 정의, 학습까지 전부",
      },
      {
        name: "seaborn (sns)",
        what: "matplotlib 위에 얹은 예쁜 통계 그래프",
        use: "데이터 점을 흩뿌리는 산점도(scatterplot)는 전부 얘로 그려",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 그래프 그리기 도구",
        use: "산점도에 축·격자 붙이고, alpha_bar 곡선·학습 손실 곡선 같은 라인 플롯",
      },
      {
        name: "clear_output",
        what: "셀 출력을 지우는 IPython 도구",
        use: "생성 과정을 애니메이션처럼 갱신할 때 이전 그림을 지워줘",
      },
      {
        name: "time",
        what: "시간 유틸",
        use: "애니메이션 루프에서 time.sleep으로 프레임 사이에 살짝 딜레이",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 계산 라이브러리",
        use: "여기선 직접 호출은 거의 없어 — sklearn·torch가 안에서 쓰는 바탕 역할",
      },
    ],
  },
  // 1 — sample_data (circles + normalize)
  "데이터를 직접 만들어주는 함수를 정의해. sklearn한테 '점 500개를 동그라미 두 겹 모양으로 찍어줘'라고 시키고 약간의 노이즈도 섞어. 그다음 좌표를 평균 0·표준편차 1로 맞춰(정규화) — 모델이 학습하기 좋게 숫자 크기를 고르게 펴주는 거야.",
  // 2 — scatter x0
  "방금 만든 함수로 실제 점들을 뽑아서 산점도로 그려서 보여줘. 우리가 앞으로 '생성해내고 싶은 정답 모양'(동그라미 두 겹)이 어떻게 생겼는지 눈으로 확인하는 거야.",
  // 3 — schedule + alpha_bar plot
  "노이즈 일정표를 짜. 1000단계에 걸쳐 매 단계 얼마나 노이즈를 섞을지(beta)를 정하고, 거기서 alpha와 '누적 alpha(alpha_bar)'를 계산해. alpha_bar 곡선을 그려보면 시간이 갈수록 원본이 얼마나 남는지(1에서 0으로 사라짐)가 한눈에 보여.",
  // 4 — forward diffusion viz
  "이제 원본이 망가지는 과정을 눈으로 보여줘. 단계를 건너뛰며 매 시점마다 '원본은 조금 + 노이즈는 점점 많이' 섞은 모습을 그려. 진행될수록 동그라미가 흐려지다 결국 완전한 노이즈 구름이 되는 게 바로 forward process야.",
  // 5 — Model class
  {
    text: "노이즈를 걷어낼 신경망을 설계해. 입력은 '노이즈 낀 점의 좌표'와 '지금 몇 번째 단계인지(t)'를 같이 받아. 층을 몇 개 쌓되 매 층마다 t 정보와 원래 입력을 다시 더해줘서(skip) 모델이 시간 감각을 잃지 않게 해. 출력은 '이 점에 낀 노이즈가 뭘까'에 대한 예측이야.",
    diagram: {
      title: "Model 신경망 구조",
      kind: "architecture",
      summary: `flowchart TD
  X["노이즈 낀 점 x_t"] --> H["은닉층 3개<br/>매 층에 시간·원본 재주입"]
  T["timestep t"] --> H
  H --> O["예측: 낀 노이즈"]`,
      detail: `flowchart TD
  X["x_t (2D)"] --> N1["LayerNorm"] --> F1["fc1: 2→128"] --> A1["LeakyReLU"]
  T["t"] --> TE["time emb<br/>Linear 1→128"]
  X --> SK["skip_fc: 2→128"]
  A1 --> P1(("+"))
  TE --> P1
  SK --> P1
  P1 --> F2["fc2: 128→128"] --> A2["LeakyReLU"] --> P2(("+"))
  TE --> P2
  SK --> P2
  P2 --> F3["fc3: 128→128"] --> A3["LeakyReLU"] --> P3(("+"))
  TE --> P3
  SK --> P3
  P3 --> OUT["output_fc: 128→2"] --> Y["예측 노이즈 (2D)"]`,
    },
  },
  // 6 — device + model
  "GPU가 있으면 GPU, 없으면 CPU를 쓰도록 정하고, 방금 설계한 모델을 그 장치에 올려. 이제부터 계산은 거기서 돌아가.",
  // 7 — training loop (imports tqdm)
  {
    text: "모델을 훈련시켜. 5만 번 반복하면서 매번 원본에 무작위 노이즈를 섞고(아무 단계나 골라서), 모델한테 '여기 낀 노이즈 맞혀봐' 시킨 뒤, 실제 노이즈와 얼마나 틀렸는지(MSE) 재서 그만큼 모델을 조금씩 고쳐. 끝나면 손실 곡선을 그려 — 아래로 내려가면 잘 배우고 있는 거야.",
    imports: [
      {
        name: "tqdm.auto.tqdm",
        what: "반복문 진행률 표시줄",
        use: "5만 스텝 학습이 지금 어디까지 갔는지 막대로 실시간 보여줘",
      },
    ],
    diagram: {
      title: "학습 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["원본 x0 준비"] --> B["50,000번 반복"]
  B --> C["랜덤 t·노이즈로 x_t 생성"]
  C --> D["모델이 노이즈 예측"]
  D --> E["MSE로 모델 갱신"]
  E --> B
  B --> F["손실 곡선 출력"]`,
      detail: `flowchart TD
  A["x0 = sample_data()"] --> B["repeat 50,000"]
  B --> N["noise ~ N(0, I)"]
  N --> T["t ~ Uniform(1, T)"]
  T --> XT["x_t = √ᾱ_t·x0 + √(1−ᾱ_t)·noise"]
  XT --> P["noise_pred = model(x_t, t)"]
  P --> L["loss = MSE(noise_pred, noise)"]
  L --> O["backward + optimizer.step()"]
  O --> B
  B --> PLOT["loss 곡선 그리기"]`,
    },
  },
  // 8 — DDPM sampling
  {
    text: "이번엔 거꾸로, 순수 노이즈에서 진짜 데이터를 만들어내. 완전 랜덤한 점에서 시작해 T단계를 거꾸로 내려오며, 매 단계 모델이 '낀 노이즈'를 예측하면 DDPM 공식대로 그만큼 살짝 걷어내. 0에 가까워질수록 점들이 다시 동그라미로 모이는 걸 중간중간 그려서 보여줘.",
    diagram: {
      title: "DDPM 샘플링 (역확산)",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 x_T"] --> B["t = T-1 … 0 반복"]
  B --> C["모델로 노이즈 예측"]
  C --> D["DDPM 공식으로 한 스텝 디노이즈"]
  D --> E{"t > 0 ?"}
  E -->|예| B
  E -->|아니오| F["완성 샘플 x_0"]`,
      detail: `flowchart TD
  A["x_T ~ N(0, I)"] --> B["t: T-1 → 0"]
  B --> C["eps = model(x_t, t)"]
  C --> M["mu = 1/√α_t · (x_t − β_t/√(1−ᾱ_t) · eps)"]
  M --> E{"t > 0 ?"}
  E -->|예| Z["z ~ N(0, I)<br/>x = mu + √β_t · z"]
  E -->|아니오| X0["x = mu (노이즈 없음)"]
  Z --> B
  X0 --> DONE["완성 샘플 x_0"]`,
    },
  },
  // 9 — sample_data blobs + labels
  "이번엔 조건부 생성을 해볼 거라 데이터를 바꿔. '4개 덩어리(blob)'를 만들고, 각 점이 몇 번 덩어리 소속인지 라벨(label)도 같이 돌려줘. 이 라벨이 곧 '어떤 클래스를 생성할지'의 조건이 될 거야.",
  // 10 — scatter hue=label
  "새 데이터를 그리되 덩어리마다 색을 다르게 칠해서 보여줘(라벨별 색). 4개 클래스가 공간에 어떻게 흩어져 있는지 확인하는 거야.",
  // 11 — schedule again
  "노이즈 일정표를 이번 실험용으로 다시 짜고, 누적 alpha 곡선을 한 번 더 그려. 앞이랑 같은 준비 단계인데 새 데이터에 맞춰 새로 세팅하는 거야.",
  // 12 — forward viz with labels (break)
  "새 데이터에도 노이즈를 섞어 망가지는 모습을 색깔별로 그려줘. (맨 끝 break 때문에 첫 장만 보여주고 멈춰 — 빠른 확인용이야.)",
  // 13 — Model with class embedding
  "모델을 조건부 버전으로 업그레이드해. 기존 t(시간)에 더해 c(클래스 라벨)도 입력으로 받고, 매 층에 클래스 정보를 같이 더해줘. 이제 모델은 '몇 단계인지'뿐 아니라 '어떤 클래스를 만들지'까지 보면서 노이즈를 예측해.",
  // 14 — device + model again
  "업그레이드한 조건부 모델을 다시 장치에 올려. 새 모델로 처음부터 학습할 준비야.",
  // 15 — training with label
  "조건부 모델을 훈련시켜. 앞이랑 거의 같은데, 노이즈를 맞히라고 할 때 클래스 라벨도 같이 넘겨줘. 이렇게 학습해야 나중에 '이 클래스로 만들어' 했을 때 그 모양이 나와.",
  // 16 — conditional DDPM sampling
  "학습된 조건부 모델로 거꾸로 생성해. 노이즈에서 시작하되 매 단계 모델한테 라벨을 같이 주면서 노이즈를 걷어내. 그러면 지정한 클래스(색깔)에 해당하는 덩어리들이 생겨나는 걸 볼 수 있어.",
  // 17 — label[0]
  "라벨의 첫 번째 값이 뭔지 슬쩍 찍어봐. 데이터가 어떻게 들어있는지 확인하는 디버깅용 한 줄이야.",
  // 18 — DDIM sampling
  "이번엔 더 빠른 생성법(DDIM)으로 해봐. DDPM처럼 매 단계 무작위 노이즈를 더하는 대신, '예측한 원본'을 이용해 거의 결정론적으로(랜덤성 없이) 단계를 건너뛰며 복원해. 결과는 비슷하면서 더 적은 무작위성으로 깔끔하게 만들어내는 방식이야.",
];

export default explanations;
