// Part 10-1 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통 펼치기. 이번 주제는 '추론을 어떻게 빠르게 하느냐'라서, 평범한 SD 파이프라인을 먼저 불러놓고 거기에 LCM이라는 가속 장치를 얹어볼 거야. GPU 없으면 CPU로 떨어지게 device도 잡아둬.",
    imports: [
      {
        name: "diffusers · StableDiffusionPipeline · DDIMScheduler",
        what: "사전학습 SD 파이프라인 + 기본 비교용 샘플러",
        use: "먼저 보통 SD를 불러와 DDIM으로 깔고, 그 위에 LCM 스케줄러·LoRA를 갈아끼워 속도를 비교해",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·시드",
        use: "fp16으로 모델 올리고 manual_seed로 같은 프롬프트를 재현 가능하게 생성",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "이미지 격자 표시",
        use: "10개 프롬프트 결과를 한 줄에 쭉 깔아 4스텝 생성 품질을 눈으로 비교",
      },
      {
        name: "numpy (np) · PIL · transforms · tqdm · clear_output · Path · load_image",
        what: "배열·이미지·전처리·진행바·경로 유틸",
        use: "대부분 시리즈 공통 import — np·PIL은 뒤쪽 ControlNet 캐니 변환에서 다시 등장해",
      },
    ],
  },
  // 1 — base pipeline + DDIM
  "비교 기준으로 보통 SD1.5 파이프라인을 fp16으로 불러오고 스케줄러는 DDIM. 아직 아무 가속도 안 건 평범한 상태야 — DDIM은 보통 20~30스텝은 줘야 그림이 멀쩡하게 나와. 이걸 기억해두고 곧 LCM과 비교해.",
  // 2 — base SD at 4 steps (intentionally bad)
  "일부러 보통 SD를 4스텝만 줘서 10개 프롬프트를 뽑아봐. 결과가 흐리고 덜 완성돼 보일 거야 — 당연해, DDIM한테 4스텝은 너무 적거든. 이 '망한 4스텝'이 바로 다음에 LCM이 해결할 문제를 보여주는 장치야. (같은 4스텝인데 LCM은 얼마나 다른지 곧 보게 돼.)",
  // 3 — swap to LCMScheduler
  {
    text: "스케줄러를 LCMScheduler로 갈아끼워. LCM(Latent Consistency Model)은 보통 디퓨전처럼 노이즈를 찔끔찔끔 여러 번 걷어내는 대신, '노이즈 낀 상태에서 곧장 깨끗한 결과로 점프'하도록 distill(증류)된 방식이라 2~4스텝이면 충분해. 스케줄러만 바꾼 거고, 실제 가속 능력은 다음 셀에서 LCM-LoRA를 얹어야 생겨.",
    diagram: {
      title: "LCM: 적은 스텝으로 점프",
      kind: "algorithm",
      summary: `flowchart TD
  N["노이즈 latent"] --> A{"방식 ?"}
  A -->|보통 디퓨전 DDIM| M["20~30스텝<br/>찔끔찔끔 디노이즈"]
  A -->|LCM| F["2~4스텝<br/>깨끗한 결과로 곧장 점프"]
  M --> OUT["이미지"]
  F --> OUT`,
    },
  },
  // 4 — inspect LCMScheduler
  "LCMScheduler가 뭔지 도움말(?)을 띄워 안을 들여다봐. 어떤 인자를 받는지·기본 스텝 수가 어떤지 같은 걸 확인하는 학습용 한 줄이야 — 실제 생성엔 영향 없어.",
  // 5 — load LCM-LoRA
  {
    text: "LCM의 진짜 알맹이를 얹어 — 'lcm-lora-sdv1-5' 어댑터야. 흥미로운 점: LCM은 모델을 통째로 새로 학습하는 대신 그 가속 능력을 LoRA 어댑터 하나로 증류해놨어. 그래서 평범한 SD1.5 위에 이 작은 LoRA만 끼우면 즉시 '몇 스텝 생성기'로 변신해 — 베이스 모델은 그대로 둔 채로. (스케줄러 LCM + 이 LoRA, 둘이 한 세트로 작동해.)",
    diagram: {
      title: "LCM-LoRA로 가속 주입",
      kind: "architecture",
      summary: `flowchart TD
  BASE["보통 SD1.5 (그대로)"] --> S["scheduler → LCMScheduler"]
  ADP["lcm-lora-sdv1-5"] --> L["load_lora_weights(name='lcm')"]
  S --> COMBO["LCM 스케줄러 + LCM-LoRA = 한 세트"]
  L --> COMBO
  COMBO --> FAST["이제 4스텝·CFG 끔으로 생성"]`,
    },
  },
  // 6 — LCM generation at 4 steps (good)
  "이제 LCM-LoRA를 켠 채 똑같이 4스텝으로 10장을 다시 뽑아 2번 결과와 비교해 — 같은 4스텝인데 훨씬 또렷하고 완성도 높게 나올 거야. 핵심 차이 둘: num_inference_steps=4(LCM이라 충분), 그리고 guidance_scale=0(LCM에선 CFG를 꺼야 함 — 켜면 오히려 깨져). 이게 LCM이 '실시간 미리보기·라이브 캔버스·대량 생성'에 쓰이는 이유야. 한 장당 시간이 1/5~1/8로 줄어드니까.",
  // 7 — ControlNet + LCM pipeline
  {
    text: "마지막으로 LCM을 ControlNet과 합쳐. ControlNet은 '구도(여기선 캐니 윤곽선)'를 입력으로 받아 생성 결과의 자세·외곽을 잡아주는 추가 제어 장치야. 여기에 LCM 스케줄러를 끼우면 '구도는 정확히 따르면서 4스텝으로 빠르게' 뽑는 조합이 돼 — 정밀 제어와 속도를 동시에. ControlNet 모델과 SD 파이프라인을 fp16으로 불러 LCMScheduler를 꽂는 단계야.",
    diagram: {
      title: "ControlNet + LCM 결합",
      kind: "architecture",
      summary: `flowchart TD
  C["ControlNet (canny)"] --> P["StableDiffusionControlNetPipeline"]
  M["SD1.5 base"] --> P
  P --> S["scheduler → LCMScheduler"]
  S --> R["구도는 ControlNet이 고정<br/>속도는 LCM이 4스텝으로"]`,
    },
  },
  // 8 — build canny control image
  {
    text: "ControlNet에 먹일 '구도 지도'를 만들어. 참조 이미지를 받아 512×512로 맞춘 뒤 OpenCV 캐니(Canny) 엣지 검출로 윤곽선만 추출해 — 색·질감은 버리고 '형태의 뼈대'만 남기는 거야. 흑백 엣지를 3채널로 복제해 control_image로 쓰고, 원본과 나란히 그려 확인해.",
    diagram: {
      title: "캐니 엣지 → 구도 지도",
      kind: "algorithm",
      summary: `flowchart TD
  R["참조 이미지 (512²)"] --> CN["cv2.Canny(100, 200)"]
  CN --> E["윤곽선만 남김 (흑백)"]
  E --> RGB["3채널로 복제"]
  RGB --> CI["control_image<br/>(ControlNet 입력)"]`,
    },
  },
  // 9 — generate with ControlNet + LCM
  "캐니 윤곽선을 따라 'a white paradise bird in the snow'를 4스텝으로 생성해. controlnet_conditioning_scale=0.8로 '구도를 얼마나 강하게 따를지'를 조절하고, LCM 덕에 단 4스텝이면 끝나. 원본·구도지도·생성결과 셋을 나란히 깔면 '윤곽은 똑같은데 내용은 새 프롬프트로 채워진' 결과가 보일 거야 — 빠른 제어 생성의 완성형이지.",
  // 10 — (empty trailing cell)
  "비어 있는 마지막 셀 — 실행해도 아무 일도 안 일어나. 노트북 끝에 흔히 남는 빈 칸이야.",
];

export default explanations;
