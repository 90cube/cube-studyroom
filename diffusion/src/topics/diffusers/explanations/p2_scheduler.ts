import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — usage: swap scheduler via from_config
  {
    text: "파이프라인을 불러온 다음, 스케줄러만 갈아끼워. compatibles를 찍어보면 이 모델에 끼울 수 있는 샘플러 목록이 나와 — U-Net이 '노이즈를 예측'하는 일만 하지 '어떻게 되돌릴지'는 안 정하기 때문에 이게 가능해. from_config로 기존 설정(betas·timestep 수 등)을 통째로 물려받고 알고리즘만 DDIM으로 바꿔. 가중치는 1도 안 건드려.",
    imports: [
      {
        name: "DiffusionPipeline",
        what: "모델 종류를 자동 판별해 불러오는 범용 파이프라인",
        use: "from_pretrained로 SD를 올리고, .scheduler 속성을 교체할 대상",
      },
      {
        name: "DDIMScheduler",
        what: "결정론적·소수 스텝 역확산 스케줄러",
        use: "from_config(pipe.scheduler.config)로 만들어 pipe.scheduler에 꽂아",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·반정밀도",
        use: "float16 dtype 지정과 .to('cuda')에만 가볍게 쓰여",
      },
    ],
    lines: {
      10: "compatibles: 이 파이프라인에 끼울 수 있는 스케줄러 클래스 목록을 출력 — 교체 가능한 후보 확인용.",
      13: "from_config(pipe.scheduler.config): 기존 betas·timestep 설정은 물려받고 알고리즘만 DDIM으로 바꿔 다시 꽂아. 가중치는 안 건드림.",
    },
  },
  // 1 — init: betas / alphas_cumprod
  {
    text: "노이즈 일정을 깔아. betas는 '각 스텝에서 섞을 노이즈 양'인데, SD는 scaled_linear(루트 공간에서 선형 후 제곱)를 써 — latent diffusion에 맞춰 튜닝된 거야. 그다음 alphas = 1 − betas, 그걸 0..t까지 누적 곱해서 alphas_cumprod(ᾱ_t)를 만들어. ᾱ_t 하나가 't 시점에 원본이 얼마나 살아있나'를 요약해 — add_noise도 step도 전부 이 값만 인덱싱해서 돌아가.",
    diagram: {
      title: "노이즈 일정이 만들어지는 흐름",
      kind: "algorithm",
      summary: `flowchart TD
  CFG["beta_schedule 선택"] --> B["betas (스텝별 노이즈 양)"]
  B --> A["alphas = 1 − betas"]
  A --> AC["alphas_cumprod ᾱ_t = 누적 곱"]
  AC --> USE["add_noise · step 이 인덱싱해서 사용"]`,
    },
    lines: {
      3: "linspace(beta_start→beta_end): 노이즈 양 betas를 시작~끝까지 일직선으로 증가. 가장 기본 스케줄.",
      8: "scaled_linear: 루트 공간에서 선형으로 깐 뒤 제곱(**2). SD가 쓰는 기본값 — latent diffusion에 맞춰 튜닝된 일정.",
      13: "cumprod: alphas를 0..t까지 누적 곱해 ᾱ_t를 만들어. 't에 원본이 얼마나 남나'를 한 숫자로 — add_noise·step이 전부 이걸 인덱싱.",
    },
  },
  // 2 — add_noise (forward, closed-form)
  {
    text: "정방향이야. 원본 x_0에 노이즈를 '한 방에' 섞어 x_t를 만들어 — 루프 없이 닫힌형 공식으로 바로 점프해. √ᾱ_t는 원본을 얼마나 남길지, √(1−ᾱ_t)는 노이즈를 얼마나 부을지의 비율이야(둘을 제곱해 더하면 1). unsqueeze로 차원을 늘리는 건 (B,) 스칼라 비율을 (B,C,H,W) 텐서에 브로드캐스트하려는 것뿐. 이렇게 만든 x_t와 정답 노이즈 ε이 학습 신호가 돼 — U-Net한테 'x_t 보고 ε 맞혀' 시키는 거지.",
    diagram: {
      title: "add_noise — 정방향 한 방 점프",
      kind: "algorithm",
      summary: `flowchart TD
  X0["깨끗한 원본 x_0"] --> MIX["x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε"]
  EPS["노이즈 ε ~ N(0,I)"] --> MIX
  AC["ᾱ_t (timesteps 로 인덱싱)"] --> MIX
  MIX --> XT["노이즈 낀 x_t (학습 입력)"]`,
      detail: `flowchart TD
  AC["alphas_cumprod[timesteps]"] --> SA["√ᾱ_t = ac ** 0.5"]
  AC --> SO["√(1−ᾱ_t) = (1−ac) ** 0.5"]
  SA --> U1["flatten + unsqueeze<br/>→ (B,1,1,1) 로 브로드캐스트"]
  SO --> U2["flatten + unsqueeze<br/>→ (B,1,1,1)"]
  X0["x_0"] --> M["noisy = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε"]
  EPS["ε"] --> M
  U1 --> M
  U2 --> M
  M --> OUT["noisy_samples"]`,
    },
    lines: {
      6: "√ᾱ_t = ᾱ_t의 제곱근. timesteps로 인덱싱해 뽑아 — 원본 x_0를 얼마나 남길지 비율.",
      11: "√(1−ᾱ_t) = 노이즈를 얼마나 부을지 비율. 6번이랑 둘을 제곱해 더하면 1이 돼.",
      16: "닫힌형 한 방: x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε. 루프 없이 t단계 노이즈를 즉시 점프. 이 x_t가 학습 입력.",
    },
  },
  // 3 — DDPM step (reverse, stochastic)
  {
    text: "역방향 한 칸. U-Net이 뱉은 노이즈 예측을 받아서, 먼저 그걸 거꾸로 풀어 '예측된 깨끗한 원본 x_0'를 구해. 그다음 x_0와 지금 샘플 x_t를 정해진 계수로 가중합해서 x_{t-1}의 평균 µ를 만들어 — 이게 DDPM 사후분포 공식이야. 마지막이 포인트: t>0이면 µ에 무작위 노이즈를 한 줌 더해. 그래서 DDPM은 '확률적'이고, 매번 조금씩 다른 경로로 내려가. t=0(마지막 스텝)에선 노이즈를 안 더해서 깔끔하게 끝나.",
    diagram: {
      title: "DDPM step — 확률적 한 칸 디노이즈",
      kind: "algorithm",
      summary: `flowchart TD
  IN["model_output (예측 ε) + 현재 x_t"] --> X0["예측 x_0 역산"]
  X0 --> MU["µ = coeff_0·x_0 + coeff_t·x_t"]
  MU --> DEC{"t > 0 ?"}
  DEC -->|예| ADD["µ + √variance · 노이즈 (확률적)"]
  DEC -->|아니오| KEEP["µ 그대로 (마지막 스텝)"]
  ADD --> OUT["x_(t−1)"]
  KEEP --> OUT`,
      detail: `flowchart TD
  A["alpha_prod_t, alpha_prod_t_prev"] --> B["beta_prod_t = 1 − ᾱ_t"]
  M["model_output (예측 ε)"] --> X0["pred_x_0 = (x_t − √β·ε) / √ᾱ_t"]
  B --> X0
  X0 --> CO["계수 2개 계산<br/>coeff_0 = √ᾱ_prev·β_t / β_prod<br/>coeff_t = √α_t·β_prod_prev / β_prod"]
  XT["현재 x_t"] --> MU["µ = coeff_0·pred_x_0 + coeff_t·x_t"]
  CO --> MU
  MU --> Q{"t > 0 ?"}
  Q -->|예| V["variance = _get_variance(t)<br/>noise ~ N(0,I)"]
  V --> ADD["x_(t−1) = µ + √variance·noise"]
  Q -->|아니오| ADD0["x_(t−1) = µ"]`,
    },
    lines: {
      9: "예측 ε을 거꾸로 풀어 '예측된 깨끗한 원본 x_0'을 역산. add_noise 공식을 x_0에 대해 푼 꼴.",
      14: "예측 x_0와 현재 x_t를 정해진 두 계수로 가중합 → x_(t-1)의 평균 µ. 이게 DDPM 사후분포(식 7).",
      22: "t>0이면 µ에 무작위 노이즈를 더해 → DDPM이 '확률적'인 이유. t=0이면 variance=0이라 그냥 µ로 깔끔히 끝.",
    },
  },
  // 4 — DDIM step (reverse, deterministic via eta)
  {
    text: "같은 자리에 끼는 다른 공식이야. DDIM도 예측 x_0를 먼저 구하는 건 똑같은데, 그다음 'x_t를 향하는 방향' 항을 더해서 x_{t-1}로 가. 진짜 핵심은 eta 하나야. eta=0이면 std_dev_t가 0이라 무작위 노이즈를 아예 안 더해 — 완전 결정론적이라 같은 시드면 같은 그림, 스텝을 확 줄여도 경로가 안정적이야(25스텝도 OK). eta를 1로 올리면 DDPM과 똑같아져. 한 클래스로 결정론↔확률론을 다이얼처럼 조절하는 거지.",
    diagram: {
      title: "DDIM step — eta 로 무작위성 조절",
      kind: "algorithm",
      summary: `flowchart TD
  IN["model_output + x_t"] --> X0["예측 x_0"]
  X0 --> DIR["x_t 방향 항 더하기"]
  DIR --> PREV["x_(t−1) (결정론 부분)"]
  PREV --> E{"eta > 0 ?"}
  E -->|예| N["+ eta·σ·노이즈 (DDPM 쪽으로)"]
  E -->|아니오| D["노이즈 없음 (순수 DDIM)"]
  N --> OUT["x_(t−1)"]
  D --> OUT`,
      detail: `flowchart TD
  PT["prev_timestep = t − T/스텝수"] --> AP["ᾱ_t, ᾱ_t_prev"]
  M["model_output"] --> X0["pred_x_0 = (x_t − √β·ε)/√ᾱ_t<br/>pred_ε = model_output"]
  AP --> VAR["variance = _get_variance(t, prev)"]
  VAR --> SD["std_dev_t = eta · √variance"]
  SD --> DIR["dir = √(1 − ᾱ_prev − σ²) · pred_ε"]
  X0 --> P["x_(t−1) = √ᾱ_prev·pred_x_0 + dir"]
  DIR --> P
  P --> Q{"eta > 0 ?"}
  Q -->|예| ADD["x_(t−1) += std_dev_t · noise"]
  Q -->|아니오| SKIP["그대로 (결정론)"]`,
    },
  },
  // 5 — application: fewer steps + AYS
  {
    text: "스케줄러 교체는 속도를 끌어올리는 1번 레버야. DPM++(DPMSolverMultistepScheduler) 같은 고차 솔버로 갈아끼우면 같은 가중치로도 20~25스텝이면 충분하고, timestep_spacing='trailing'을 주면 같은 스텝 수에서 디테일이 더 살아. 한 발 더 나가서 NVIDIA의 Align Your Steps 타임스텝(AysSchedules)을 통째로 넘기면 10스텝까지 줄일 수 있어 — num_inference_steps 대신 timesteps에 명시 리스트를 꽂는 방식이야. 가중치 재학습 0, 코드 두 줄로 추론 시간을 반 토막 내는 거지.",
    imports: [
      {
        name: "DPMSolverMultistepScheduler",
        what: "DPM++ 고차 ODE 솔버 — 적은 스텝으로 고품질",
        use: "from_config로 끼워 20~25스텝 추론, sde-dpmsolver++ / trailing 옵션 지정",
      },
      {
        name: "AysSchedules",
        what: "Align Your Steps — 10스텝 최적화 타임스텝 사전(dict)",
        use: "['StableDiffusionXLTimesteps']를 꺼내 pipe(timesteps=...)에 직접 주입",
      },
    ],
  },
];

export default explanations;
