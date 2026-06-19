// Part 8.2 IP-Adapter + ControlNet 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports
  {
    text: "IP-Adapter(이미지 프롬프트)와 ControlNet(구조 제어)을 한 파이프라인에서 합치는 게 이번 주제야. 둘은 서로 다른 손잡이를 잡아 — ControlNet은 '구도/형태(여기선 뎁스)'를, IP-Adapter는 '스타일/외형(참조 이미지)'을 담당해서, '이 구조 위에 + 저 이미지의 느낌'을 동시에 지시할 수 있어. 먼저 공통 도구부터 꺼내.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·시드",
        use: "float16 로드, device 선택, 생성 반복",
      },
      {
        name: "numpy (np)",
        what: "수치 배열",
        use: "뎁스 맵 1채널을 3채널로 쌓아(concatenate) ControlNet 입력으로 가공",
      },
      {
        name: "diffusers.utils.load_image",
        what: "이미지 로더",
        use: "뎁스를 뽑을 원본과 IP-Adapter 참조 이미지(statue.png)를 불러와",
      },
      {
        name: "PIL.Image",
        what: "이미지 객체",
        use: "가공한 뎁스 배열을 다시 PIL 이미지로 되돌려 파이프라인에 입력",
      },
      {
        name: "diffusers.StableDiffusionPipeline · DDIMScheduler · DPMSolverMultistepScheduler",
        what: "기본 파이프라인 + 샘플러들",
        use: "DDIM으로 교체(임포트는 다음 셀에서 ControlNet 파이프라인으로 대체)",
      },
      {
        name: "matplotlib · tqdm · torchvision · clear_output · pathlib",
        what: "플롯·진행바·변환·출력 유틸",
        use: "뎁스 맵·생성 결과 시각화에 보조로",
      },
    ],
  },
  // 1 — 뎁스 ControlNet + 파이프라인 로드
  {
    text: "구조 손잡이부터 끼워. control_v11f1p_sd15_depth ControlNet을 SD1.5에 붙여 StableDiffusionControlNetPipeline을 만들고 스케줄러를 DDIM으로 갈아. 뎁스 ControlNet은 '카메라로부터의 거리 지도'를 받아 장면의 입체 배치를 고정해줘 — 다음에 IP-Adapter를 추가로 끼우면, 이 뎁스 구조를 유지한 채 참조 이미지의 외형을 입히게 돼.",
    diagram: {
      title: "IP-Adapter + ControlNet 이중 조건",
      kind: "architecture",
      summary: `flowchart TD
  DEP["뎁스 맵"] --> CN["ControlNet (depth)"]
  REF["참조 이미지"] --> IP["IP-Adapter"]
  CN -->|"구조 잔차"| U["얼린 SD UNet"]
  IP -->|"이미지 cross-attn"| U
  T["텍스트(빈 프롬프트)"] --> U
  U --> O["구조=뎁스, 외형=참조"]`,
      detail: `flowchart TD
  SRC["원본 이미지"] --> DE["depth_estimator"]
  DE --> DEP["뎁스 맵 (3ch)"]
  DEP --> CN["controlnet(depth)"]
  CN --> RES["down/mid 잔차"]
  REF["statue.png"] --> ENC["IP-Adapter 이미지 인코더"]
  ENC --> KIV["이미지 K/V (분리형 attn)"]
  RES --> U["얼린 UNet"]
  KIV -->|"scale=1.0"| U
  U --> N["노이즈 예측"]
  N --> ST["DDIM step ×50"]
  ST --> O["디코드 → 결과"]`,
    },
  },
  // 2 — 뎁스 추정기 로드
  "뎁스 맵을 만들 추정기를 준비해. transformers.pipeline('depth-estimation')에 가벼운 'Distill-Any-Depth-Small' 모델을 지정해 — 작고 빠르면서도 거리 추정이 깔끔해. 이게 원본 사진에서 '어디가 가깝고 어디가 먼지'를 뽑아낼 도구야.",
  // 3 — 뎁스 맵 생성 + 시각화
  "참조 장면(vermeer.jpg)에서 뎁스 맵을 뽑아. 추정기를 돌려 거리 정보를 흑백으로 받고, 1채널을 3번 쌓아 ControlNet이 받는 RGB 3채널로 만든 뒤 PIL 이미지로 되돌려. 그려보면 가까운 인물은 밝게/배경은 어둡게 — 이 입체 배치가 곧 생성 결과의 골격(구도)이 될 거야.",
  // 4 — IP-Adapter 가중치 로드
  "이제 외형 손잡이를 추가해. 같은 파이프라인에 h94/IP-Adapter의 'ip-adapter_sd15'(기본 변형)를 끼워. 이러면 한 파이프라인이 ControlNet(뎁스 구조)과 IP-Adapter(이미지 외형) 두 조건을 동시에 받게 돼 — 이미 끼운 뎁스 ControlNet은 그대로 두고 이미지 프롬프트 통로만 새로 여는 거야.",
  // 5 — 이중 조건 생성 (뎁스 + 참조 이미지)
  {
    text: "두 조건을 동시에 먹여 생성해. set_ip_adapter_scale(1.0)으로 참조 이미지를 강하게 반영하고, image=뎁스맵(구조)·ip_adapter_image=statue(외형)·prompt=''(텍스트 끔)로 5장을 뽑아. 결과는 '베르메르 그림의 입체 구도'는 그대로인데 '조각상 이미지의 질감·외형'으로 채워진 합성이 나와. 이 조합이 실전에서 강력한 이유 — 제품 사진을 원하는 구도(뎁스)에 고정한 채 레퍼런스 무드로 리라이팅하거나, 캐릭터를 정해진 포즈/배치에 두고 일관된 외형으로 찍어내는 데 쓰여(diffusers 공식 문서도 IP-Adapter의 대표 응용으로 'ControlNet과 결합한 구조 제어'를 든다).",
    diagram: {
      title: "이중 조건 생성 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈"] --> B["50스텝 반복"]
  B --> C["ControlNet(뎁스) → 구조 잔차"]
  B --> D["IP-Adapter(참조) → 이미지 attn"]
  C --> E["UNet 노이즈 예측"]
  D --> E
  E --> F["DDIM step"]
  F --> B
  B --> G["디코드 → 5장"]`,
      detail: `flowchart TD
  A["latent ~ N(0,I)"] --> B["t in 50 steps"]
  DEP["뎁스 맵"] --> CN["controlnet → down/mid 잔차"]
  REF["statue (256)"] --> IPE["이미지 인코더 → K/V"]
  CN --> U["얼린 UNet(+구조 잔차)"]
  IPE -->|"scale=1.0"| U
  B --> U
  U --> N["noise_pred"]
  N --> ST["scheduler.step → x_t−1"]
  ST --> B
  B --> DEC["VAE decode → seed별 5장"]`,
    },
  },
];

export default explanations;
