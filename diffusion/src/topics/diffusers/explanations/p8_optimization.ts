import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — LCM-LoRA 4-step usage
  {
    text: "제일 손쉬운 가속이야. 평소처럼 SDXL을 불러놓고 두 가지만 해: latent-consistency/lcm-lora-sdxl를 load_lora_weights로 끼우고, 스케줄러를 LCMScheduler.from_config로 갈아끼워. 그러면 25~50스텝짜리가 4스텝으로 떨어져. 한 가지 꼭 기억할 함정 — guidance_scale을 0~2로 낮춰야 해. LCM은 CFG(텍스트 충실도 밀어주기)가 distillation 과정에 이미 녹아 있어서, 평소처럼 7.5를 주면 이중으로 밀려 이미지가 타버려. 0이나 1쯤이 정상이야.",
    imports: [
      {
        name: "DiffusionPipeline",
        what: "범용 파이프라인 로더",
        use: "SDXL을 fp16으로 불러와 LCM-LoRA를 끼움",
      },
      {
        name: "LCMScheduler",
        what: "Latent Consistency Model 스케줄러 (소수 스텝)",
        use: "from_config로 기존 설정 물려받아 pipe.scheduler에 교체",
      },
      {
        name: "torch",
        what: "텐서·GPU·반정밀도",
        use: "float16·cuda 배치",
      },
    ],
  },
  // 1 — LCM step internals (algorithm)
  {
    text: "LCM이 왜 큰 점프가 되는지가 step 안에 있어. 보통 스케줄러는 매 스텝 노이즈를 '조금씩' 빼지만, LCM은 다르게 시켜: 현재 노이즈 낀 sample과 모델 출력으로 x_0(완성본)를 곧장 추정해(predicted_original_sample). 그다음 경계조건 c_skip·c_out으로 'x_0 추정값'과 '현재 sample'을 섞어 denoised를 만들고 — 마지막 스텝이 아니면 다음 시점만큼 노이즈를 다시 주입해(멀티스텝). 즉 한 스텝마다 완성본을 통째로 겨냥했다가 살짝 뒤로 물러서는 식이라 4번이면 충분해. consistency model의 핵심 트릭이야.",
    diagram: {
      title: "LCMScheduler.step — 큰 점프의 원리",
      kind: "algorithm",
      summary: `flowchart TD
  IN["model_output + 현재 sample (x_t)"] --> X0["x_0 곧장 추정<br/>predicted_original_sample"]
  X0 --> MIX["denoised = c_out·x_0 + c_skip·x_t"]
  MIX --> L{"마지막 스텝 ?"}
  L -->|아니오| RE["다음 시점만큼<br/>노이즈 재주입"]
  L -->|예| OUT["완성본 그대로 반환"]
  RE --> PREV["prev_sample (x_t-1)"]`,
      detail: `flowchart TD
  A["alpha_prod_t, beta_prod_t 계산"] --> CB["c_skip, c_out<br/>(경계조건 스케일)"]
  CB --> P{"prediction_type ?"}
  P -->|epsilon| E["x_0 = (x_t − √β·ε) / √α"]
  P -->|v_prediction| V["x_0 = √α·x_t − √β·v"]
  E --> CL["clip / threshold (옵션)"]
  V --> CL
  CL --> DEN["denoised = c_out·x_0 + c_skip·x_t"]
  DEN --> S{"step_index ≠ 마지막 ?"}
  S -->|예| N["noise ~ N(0,I)<br/>prev = √α_prev·denoised + √β_prev·noise"]
  S -->|아니오| F["prev = denoised"]
  N --> R["LCMSchedulerOutput(prev_sample, denoised)"]
  F --> R`,
    },
  },
  // 2 — c_skip / c_out boundary conditions
  "c_skip과 c_out이 LCM의 '경계조건'이야 — consistency model이 t=0에서 항등함수(아무것도 안 바꿈)에 수렴하도록 강제하는 장치지. 정의를 보면 timestep을 timestep_scaling(기본 10.0)으로 키운 뒤, 노이즈가 많은 큰 t에서는 c_out이 커져서 x_0 추정값을 많이 반영하고, t가 0에 가까워지면 c_skip이 1로 가서 현재 sample을 거의 그대로 유지해. 즉 '많이 망가졌을 땐 과감히 완성본을 겨냥하고, 거의 다 됐을 땐 손대지 마라'를 수식으로 박아둔 거야. 이 부드러운 전환 덕에 소수 스텝에서도 안정적이야.",
  // 3 — VRAM slicing toggles
  "여기부턴 VRAM 절감 토글이야. 전부 한 줄짜리 스위치라 메모리가 빠듯할 때만 켜면 돼. enable_attention_slicing은 어텐션 행렬을 쪼개서 계산해 피크 메모리를 낮춰 — 대신 속도가 살짝 줄어. enable_vae_slicing은 배치를 1장씩 디코딩하고, enable_vae_tiling은 큰 해상도를 겹치는 타일로 나눠 디코딩해. 한 가지 알아둘 점: PyTorch 2.0부터 SDPA(scaled_dot_product_attention)가 기본이라 최신 GPU에선 어텐션이 이미 메모리 효율적이어서 attention slicing 이득이 줄었어. 그러니 OOM이 날 때 마지막 카드로 쓰는 거야.",
  // 4 — CPU offload
  "모델 전체가 VRAM에 안 들어갈 때 쓰는 카드야. enable_model_cpu_offload는 안 쓰는 컴포넌트(텍스트 인코더·VAE 등)를 CPU에 내려놨다가 필요할 때만 GPU로 올려 — 모델 '단위'로 옮겨서 통신 오버헤드가 적고 빠른 편이라 보통 이걸 권장해. enable_sequential_cpu_offload는 서브모듈 단위라 메모리는 더 아끼지만 왔다 갔다가 잦아서 매우 느려. 제일 흔한 실수가 이거야 — 호출 전에 pipe.to('cuda')를 하면 안 돼. 그러면 이미 다 GPU에 올라가 버려서 오프로드가 디바이스를 관리할 여지가 없어지고 절약 효과가 사라져. 그냥 from_pretrained 한 뒤 바로 offload만 켜.",
  // 5 — quantization
  {
    text: "마지막은 양자화 — Flux처럼 12B가 넘어서 fp16으로도 24GB를 깨는 모델을 소비자 GPU에 욱여넣는 방법이야. PipelineQuantizationConfig에 백엔드(bitsandbytes_4bit)랑 어떤 컴포넌트를 줄일지(transformer, text_encoder_2)를 적어주면, from_pretrained가 로드하면서 가중치를 4bit로 압축해. 정밀도는 약간 깎이지만 메모리가 확 줄어. 진짜 실서비스 구성은 이걸 조합하는 거야 — LCM 4스텝(속도) + 4bit 양자화(용량) + model offload(VRAM). 셋을 합치면 빠르고·작고·돌아가는 파이프라인이 나와. 그래서 마지막 줄에서 num_inference_steps=4, guidance_scale=0.0으로 LCM까지 같이 켰어.",
    imports: [
      {
        name: "DiffusionPipeline",
        what: "범용 파이프라인 로더",
        use: "quantization_config를 받아 양자화된 채로 Flux를 로드",
      },
      {
        name: "PipelineQuantizationConfig",
        what: "파이프라인 단위 양자화 설정 (백엔드·비트수·대상)",
        use: "bitsandbytes 4bit + 대상 컴포넌트 지정",
      },
      {
        name: "torch",
        what: "텐서·GPU·연산 dtype",
        use: "bnb_4bit_compute_dtype=bfloat16 지정",
      },
    ],
  },
];

export default explanations;
