import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — from_config 로 알고리즘만 교체
  {
    text: "Part 1에서 scheduler가 부품이라고 했지? 이제 진짜로 갈아끼워. 먼저 compatibles를 찍으면 이 모델에 끼울 수 있는 샘플러 후보가 쭉 나와 — U-Net은 '노이즈가 뭔지'만 예측하고 '어떻게 되돌릴지'는 안 정하니까 이 교체가 성립해. from_config는 기존 설정(betas·timestep 수·prediction_type)을 통째로 물려받고 알고리즘만 Euler로 바꿔 다시 꽂아. 가중치는 1도 안 건드려.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — fp16 dtype·GPU",
        use: "torch_dtype=torch.float16 와 .to('cuda') 에만 쓰여",
      },
      {
        name: "DiffusionPipeline",
        what: "모델 종류를 자동 판별해 불러오는 범용 파이프라인",
        use: "from_pretrained로 SD를 올리고 .scheduler를 교체할 대상",
      },
      {
        name: "EulerDiscreteScheduler",
        what: "1차 ODE 솔버 — 단순·안정적인 역확산",
        use: "from_config(pipe.scheduler.config)로 만들어 pipe.scheduler에 꽂음",
      },
    ],
    lines: {
      10: "compatibles: 이 파이프라인에 끼울 수 있는 스케줄러 클래스 목록 — 교체 후보 확인용.",
      13: "from_config(pipe.scheduler.config): 기존 설정은 물려받고 알고리즘만 Euler로 바꿔 다시 꽂아. 가중치 불변.",
    },
  },
  // 1 — 샘플러 4종 비교
  {
    text: "같은 자리에 끼는데 '역확산을 어떻게 밟느냐'가 달라. Euler는 1차라 단순, DPM++는 고차 다단계라 20스텝 안쪽도 깔끔, DDIM은 결정론적이라 적은 스텝에 강하고, UniPC는 training-free 고차라 더 적은 스텝을 노려. 코드 패턴은 전부 똑같아 — from_config로 클래스만 바꿔 끼우고 스텝 수만 조절하면 돼. 그래서 '한 줄 교체로 속도·품질을 실험'할 수 있는 거야.",
    diagram: {
      title: "고정 모델 + 샘플러 선택지",
      kind: "algorithm",
      summary: `flowchart LR
  M["고정된 모델 (unet·vae 가중치)"] --> S{"scheduler 선택"}
  S --> E["Euler (1차·안정)"]
  S --> D["DPM++ (고차 다단계)"]
  S --> I["DDIM (결정론)"]
  S --> U["UniPC (고차·소스텝)"]
  E --> O["같은 그림, 다른 속도·품질"]
  D --> O
  I --> O
  U --> O`,
    },
    lines: {
      8: "DPMSolverMultistepScheduler = DPM++. 고차 다단계 솔버라 20스텝 안쪽에서도 깔끔.",
      12: "DDIMScheduler = 결정론(eta=0). 같은 시드면 같은 그림, 적은 스텝에 강함.",
      16: "UniPCMultistepScheduler = training-free 고차. 15스텝처럼 더 적은 스텝을 노림.",
    },
  },
  // 2 — timestep_spacing 미세 조정
  {
    text: "from_config에 옵션을 얹으면 같은 샘플러도 더 다듬을 수 있어. timestep_spacing은 1000개 학습 타임스텝에서 추론용 몇십 개를 '어떻게 고를지'를 정해 — leading(기본)·linspace(균등)·trailing(끝점 정렬). 스텝이 적을수록 trailing이 마지막 디테일을 더 살리는 경우가 많아. 가중치 재학습 0, 옵션 한 줄로 끝. 이 'from_config + 옵션' 패턴이 다음 Part의 LCMScheduler에도 그대로 이어져.",
    imports: [
      {
        name: "DPMSolverMultistepScheduler",
        what: "DPM++ 고차 솔버 — 적은 스텝으로 고품질",
        use: "from_config에 algorithm_type·timestep_spacing 옵션을 얹어 끼움",
      },
    ],
    lines: {
      7: "timestep_spacing='trailing': 추론 타임스텝을 끝점 정렬로 고름 — 적은 스텝에서 디테일 보존에 유리.",
    },
  },
];

export default explanations;
