import type { ExplanationEntry } from "./types";

// a4-distill-zoo: 코드 셀 5개 -> 설명 5개.
// 셀 순서: (0) LCM-LoRA, (1) SDXL-Lightning 풀 UNet, (2) SDXL-Turbo, (3) Hyper-SD.
// 첫 코드 셀에 세 기법 비교 다이어그램(판별자 차이가 핵심).

const explanations: ExplanationEntry[] = [
  // 0 — LCM-LoRA: load_lora_weights + LCMScheduler
  {
    text: "가장 간단한 가속부터. LCM은 LoRA 어댑터라 베이스 SDXL을 안 가려 — load_lora_weights로 얹기만 하면 돼. 그다음 스케줄러를 LCMScheduler로 바꿔야 '소수 스텝 직행' 규칙이 켜져. 추론은 4스텝, guidance_scale은 1.0처럼 낮게 — 일반 SDXL은 7쯤 쓰지만 증류 모델에 높은 guidance를 주면 그림이 타버려. LCM은 판별자(심사위원)를 안 쓰고, 'ODE 위 어느 점에서든 같은 답으로 가라'는 consistency만으로 증류한 거란 게 핵심이야.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "repo만 주면 맞는 text2img 파이프라인 클래스를 자동 선택",
        use: "SDXL 베이스를 올리고, load_lora_weights·scheduler 교체의 대상",
      },
      {
        name: "LCMScheduler",
        what: "LCM 전용 스케줄러 — PF-ODE를 소수 스텝으로 직행",
        use: "from_config로 만들어 pipe.scheduler에 꽂아야 4스텝이 켜짐",
      },
    ],
    diagram: {
      title: "세 기법 비교 — 같은 '증류'지만 판별자가 다르다",
      kind: "architecture",
      summary: `flowchart TD
  T["느린 teacher SD<br/>(수십 스텝)"] --> Q{"증류 기법?"}
  Q --> L["LCM<br/>consistency<br/>판별자 없음"]
  Q --> LI["SDXL-Lightning<br/>progressive + adversarial"]
  Q --> TU["SDXL-Turbo<br/>ADD (adversarial)"]
  LI --> LID["심사위원 = SDXL 자기 U-Net<br/>(잠재 latent 공간)"]
  TU --> TUD["심사위원 = DINOv2<br/>(픽셀 pixel 공간)"]
  L --> OUT["few-step student (1~8)"]
  LID --> OUT
  TUD --> OUT`,
      detail: `flowchart TD
  T["teacher: 수십 스텝 SD"] --> Q{"무엇을 기준으로 student를 다그치나?"}
  Q -->|"ODE 위 두 점이 같은 답"| L["LCM / LCM-LoRA<br/>consistency distillation<br/>판별자 안 씀 · LCMScheduler · guidance 낮게"]
  Q -->|"스텝 반씩 줄이며 진짜같음 채점"| LI["SDXL-Lightning<br/>progressive + adversarial"]
  Q -->|"처음부터 적대 학습"| TU["SDXL-Turbo / SD-Turbo<br/>ADD"]
  Q -->|"구간별 consistency + 사람 피드백"| HY["Hyper-SD<br/>TCD · TCDScheduler"]
  LI --> LID{"판별 공간?"}
  LID -->|"잠재 latent"| LIDD["판별자 = SDXL 자기 U-Net"]
  TU --> TUD{"판별 공간?"}
  TUD -->|"픽셀 pixel"| TUDD["판별자 = DINOv2 (자기지도 비전)"]
  L --> OUT["1~8 스텝 student"]
  LIDD --> OUT
  TUDD --> OUT
  HY --> OUT`,
    },
    lines: {
      11: "load_lora_weights: LCM-LoRA 어댑터(~100MB)를 베이스 위에 얹어. 베이스를 안 가려서 어떤 SDXL에든 끼움.",
      14: "LCMScheduler.from_config: betas 등 설정은 물려받고 알고리즘만 LCM으로. 이게 켜져야 4스텝 직행이 됨.",
      18: "num_inference_steps=4: 50스텝을 4스텝으로. consistency 증류 덕에 적은 스텝으로도 답에 직행.",
      19: "guidance_scale=1.0: 증류 모델은 guidance 낮게. 7처럼 높이면 그림이 과포화돼 깨짐.",
    },
  },
  // 1 — SDXL-Lightning: full UNet via from_config + load_state_dict
  {
    text: "Lightning은 LoRA 형태도 있지만 여기선 '풀 UNet'을 끼우는 길을 보여줘. 핵심 트릭: 베이스 SDXL의 빈 UNet 골격을 from_config로 찍어내고, 거기에 Lightning 가중치를 load_state_dict로 부어 넣어 — 구조는 SDXL 그대로, 내용물만 Lightning으로 갈아끼우는 거야. 그리고 두 가지를 꼭 지켜: guidance_scale=0(Lightning은 CFG를 끔), 스케줄러는 EulerDiscreteScheduler에 timestep_spacing='trailing'. trailing은 소수 스텝에서 마지막 타임스텝까지 정확히 밟게 해줘. Lightning의 증류 비결은 progressive(스텝을 4→2→1로 반씩 줄임)에 adversarial을 더한 것이고, 그 심사위원이 바로 SDXL 자기 U-Net(잠재공간)이야.",
    imports: [
      {
        name: "StableDiffusionXLPipeline",
        what: "SDXL text2img 파이프라인 (UNet을 교체 가능)",
        use: "from_pretrained에 unet=...로 Lightning UNet을 끼워 조립",
      },
      {
        name: "UNet2DConditionModel",
        what: "SD/SDXL의 U-Net 모델 클래스",
        use: "from_config로 빈 골격을 만들고 Lightning 가중치를 load_state_dict",
      },
      {
        name: "EulerDiscreteScheduler",
        what: "Euler 계열 스케줄러 (trailing 간격 지원)",
        use: "from_config(..., timestep_spacing='trailing')로 소수 스텝 정렬",
      },
      {
        name: "hf_hub_download",
        what: "HF 허브에서 단일 파일을 내려받는 함수",
        use: "Lightning UNet .safetensors 한 개를 받아 경로를 넘김",
      },
      {
        name: "load_file",
        what: "safetensors 파일을 state_dict로 읽는 로더",
        use: "받은 체크포인트를 읽어 unet.load_state_dict에 전달",
      },
    ],
    lines: {
      11: "from_config(base, subfolder='unet'): 가중치 없이 SDXL UNet '골격'만 생성. 부어 넣을 빈 그릇.",
      12: "load_state_dict(load_file(...)): Lightning 4-step 가중치를 골격에 부어 넣음. 구조=SDXL, 내용=Lightning.",
      15: "unet=unet: 조립할 때 베이스 UNet 대신 Lightning UNet을 끼워 파이프라인을 만든다.",
      20: "timestep_spacing='trailing': 소수 스텝에서 끝 타임스텝까지 정확히 밟게 하는 정렬 (Lightning 권장).",
      26: "guidance_scale=0: Lightning은 CFG를 끔. 켜면 오히려 품질이 깨져.",
    },
  },
  // 2 — SDXL-Turbo: dedicated checkpoint
  {
    text: "Turbo는 LoRA가 아니라 전용 모델이야 — student를 베이스 가중치로 초기화한 뒤 ADD로 다시 학습한 결과를 통째로 불러와. 그래서 코드가 제일 짧아: from_pretrained 한 줄. 추론은 1스텝 + guidance_scale=0.0이면 거의 실시간이야. Turbo의 증류 비결 ADD(Adversarial Diffusion Distillation)의 심사위원은 Lightning과 달리 DINOv2 — 픽셀공간에서 '진짜 사진 같냐'를 채점하는 자기지도 비전 모델이야. 이 '판별자가 픽셀의 DINOv2'라는 점이 Turbo를 Lightning과 가르는 핵심 차이야.",
    lines: {
      6: "from_pretrained('stabilityai/sdxl-turbo'): Turbo는 전용 체크포인트를 통째로 로드. LoRA를 얹는 게 아님.",
      13: "num_inference_steps=1: ADD 증류 덕에 1스텝으로 그림 완성 — 거의 실시간.",
      14: "guidance_scale=0.0: Turbo도 CFG를 끔 (ADD 모델 공통).",
    },
  },
  // 3 — Hyper-SD: LoRA + TCDScheduler
  {
    text: "마지막으로 Hyper-SD. 끼우는 법은 LCM-LoRA랑 거의 같아 — LoRA를 얹고 스케줄러만 바꿔. 다만 스케줄러를 TCDScheduler로 둬(LCMScheduler도 가능). Hyper-SD의 증류는 trajectory를 구간으로 쪼개 consistency를 맞추고(TSCD) 거기에 human feedback을 더한 거야. 1-step LoRA에선 fuse_lora로 가중치를 녹여 붙이고, eta로 디테일을 조절해 — TCD 스케줄러의 특성이지. 정리하면: LoRA라 베이스 자유 + 1~8 스텝 + 사람 선호 반영이 Hyper-SD의 자리야.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "맞는 text2img 파이프라인을 자동 선택",
        use: "SDXL 베이스 로드 후 Hyper-SD LoRA를 얹을 대상",
      },
      {
        name: "TCDScheduler",
        what: "Trajectory Consistency Distillation 스케줄러 (eta로 디테일 조절)",
        use: "from_config로 끼워 Hyper-SD 소수 스텝 추론을 켬",
      },
      {
        name: "hf_hub_download",
        what: "HF 허브 단일 파일 다운로더",
        use: "Hyper-SDXL 1step LoRA .safetensors를 받아 경로 전달",
      },
    ],
    lines: {
      14: "load_lora_weights: Hyper-SD LoRA를 베이스에 얹어. LCM처럼 베이스를 안 가림.",
      15: "fuse_lora: LoRA 가중치를 베이스에 녹여 붙임 — 1-step 권장 패턴.",
      16: "TCDScheduler.from_config: Hyper-SD 전용 소수 스텝 스케줄러로 교체.",
      23: "eta=1.0: TCD 스케줄러의 디테일 다이얼. 1-step에서 무작위성/디테일을 조절.",
    },
  },
];

export default explanations;
