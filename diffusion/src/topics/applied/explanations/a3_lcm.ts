import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — LCMScheduler.step: 경계조건으로 x_0 직행
  {
    text: "LCM의 '직행'이 코드로 어떻게 생겼는지 실제 step 발췌로 보자. 먼저 U-Net 출력으로 '예측 x_0'을 만들고(다른 스케줄러랑 여기까진 비슷해), 핵심은 그다음이야 — consistency 경계조건 계수 c_out·c_skip으로 denoised = c_out·x_0 + c_skip·sample을 만들어 ODE 해답으로 곧장 끌어당겨. 그래서 한 스텝이 멀리 점프해. 마지막 스텝이 아니면 다음 노이즈 레벨로 살짝 되-노이즈(multi-step), 마지막이면 노이즈 없이 denoised 그대로 뱉어 — 이게 1스텝도 되는 이유야.",
    diagram: {
      title: "LCMScheduler.step — 경계조건으로 x_0 직행",
      kind: "algorithm",
      summary: `flowchart TD
  IN["model_output + 현재 sample"] --> X0["예측 x_0 역산"]
  X0 --> CLIP["clip (수치 안정)"]
  CLIP --> D["denoised = c_out·x_0 + c_skip·sample<br/>(consistency 직행)"]
  D --> Q{"마지막 스텝?"}
  Q -->|아니오| RN["다음 레벨로 노이즈 재주입 (multi-step)"]
  Q -->|예| OUT["denoised 그대로 반환"]
  RN --> OUT2["prev_sample"]`,
      detail: `flowchart TD
  M["model_output (예측 ε)"] --> X0["pred_x_0 = (sample − √β·ε)/√ᾱ_t"]
  X0 --> C["clip_sample 이면 clamp"]
  C --> BC["c_skip, c_out = 경계조건 계수"]
  BC --> DEN["denoised = c_out·pred_x_0 + c_skip·sample"]
  DEN --> Q{"step_index ≠ 마지막 ?"}
  Q -->|예| Z["noise ~ N(0,I)"]
  Z --> PS["prev = √ᾱ_prev·denoised + √β_prev·noise"]
  Q -->|아니오| PS0["prev = denoised (노이즈 없음)"]`,
    },
    lines: {
      3: "예측 ε을 거꾸로 풀어 '예측된 깨끗한 원본 x_0'을 역산 — 여기까진 DDIM류와 비슷.",
      12: "denoised = c_out·x_0 + c_skip·sample: consistency 경계조건으로 ODE 해답에 직행. LCM의 심장.",
      15: "마지막 스텝이 아니면 다음 레벨로 노이즈 재주입(multi-step). 마지막/1스텝이면 이 블록을 건너뛰어 노이즈 0.",
    },
  },
  // 1 — 네이티브 LCM 모델 추론
  {
    text: "LCM으로 증류된 체크포인트를 쓰는 법이야. 포인트는 둘 — (1) 전용 LCMScheduler를 끼우고, (2) 적은 스텝 + 낮은 guidance로 부른다. LCM은 guidance를 학습에 녹여놨기 때문에 추론 때 guidance_scale을 1.0처럼 낮게 둬야 색이 안 타. num_inference_steps=4가 표준이고, 2스텝까지도 버텨. teacher라면 50스텝 걸릴 걸 student가 4스텝에 끝내는 거지.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — fp16 dtype",
        use: "torch_dtype=torch.float16 와 .to('cuda') 에 쓰여",
      },
      {
        name: "DiffusionPipeline",
        what: "범용 파이프라인 로더",
        use: "from_pretrained로 LCM 증류 체크포인트를 올림",
      },
      {
        name: "LCMScheduler",
        what: "consistency 경계조건으로 x_0에 직행하는 LCM 전용 스케줄러",
        use: "from_config로 끼워 4스텝 추론을 가능케 함",
      },
    ],
    lines: {
      11: "LCMScheduler.from_config: 기존 config는 물려받고 LCM 전용 스텝 규칙으로 교체 — 적은 스텝의 전제.",
      15: "num_inference_steps=4: LCM 표준. consistency 직행 덕에 2~4스텝으로 충분.",
      16: "guidance_scale=1.0: LCM은 guidance를 학습에 녹여 — 추론 땐 0~2로 낮게 둬야 색이 안 탄다.",
    },
  },
  // 2 — LCM-LoRA: 범용 가속 모듈
  {
    text: "진짜 실전 패턴은 이거야. LCM 증류를 베이스에 굽지 않고 LoRA 어댑터(~100MB)로 떼어내, 같은 계열(SD1.5/SDXL) 베이스면 학습 없이 끼우기만 하면 가속이 붙어. 레시피는 늘 고정: (1) scheduler를 LCMScheduler로, (2) load_lora_weights로 LCM-LoRA 어댑터를 얹고, (3) num_inference_steps≈4 + guidance 낮게. Part 1의 '부품 교체'가 여기서 'LoRA 끼우기 + 스케줄러 교체'로 그대로 응용되는 거야 — 어떤 SDXL 베이스든 통째로 갈아끼우지 않고 가속만 입힌다.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — fp16 dtype",
        use: "torch_dtype=torch.float16 와 variant='fp16' 로딩에 쓰여",
      },
      {
        name: "AutoPipelineForText2Image",
        what: "repo→t2i 클래스를 자동 선택하는 파이프라인",
        use: "아무 SDXL 베이스를 올려 LCM-LoRA를 끼울 토대로 삼음",
      },
      {
        name: "LCMScheduler",
        what: "LCM 전용 스케줄러",
        use: "LoRA를 끼우기 전에 scheduler 자리부터 LCM으로 교체",
      },
    ],
    lines: {
      12: "scheduler를 먼저 LCMScheduler로 교체 — LoRA만 끼우고 스케줄러를 안 바꾸면 적은 스텝이 안 됨.",
      13: "load_lora_weights('latent-consistency/lcm-lora-sdxl'): 범용 가속 LoRA를 학습 없이 베이스에 얹음.",
      17: "num_inference_steps=4 + 낮은 guidance: LCM-LoRA의 표준 추론 조건.",
    },
  },
];

export default explanations;
