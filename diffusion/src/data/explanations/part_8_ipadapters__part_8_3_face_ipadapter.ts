// Part 8.3 Face IP-Adapter 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports
  {
    text: "이번엔 IP-Adapter로 '얼굴 정체성'을 옮기는 게 목표야 — 한 사람의 얼굴 사진을 주면, 전혀 다른 장면·복장·화풍 속에서도 같은 인물로 보이게 생성하는 거지. 얼굴은 조금만 틀어져도 '딴 사람'이 되니까 전용 어댑터와 안정적 샘플러가 필요해. 먼저 SD1.5를 올릴 도구부터 꺼내.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·시드",
        use: "float16 로드, device 선택, manual_seed로 결과 고정",
      },
      {
        name: "diffusers.utils.load_image",
        what: "이미지 로더",
        use: "정체성을 옮길 얼굴 사진(mohan_face.jpg)을 불러와",
      },
      {
        name: "diffusers.StableDiffusionPipeline",
        what: "기본 text-to-image 파이프라인",
        use: "여기에 얼굴 IP-Adapter를 끼워 정체성 유지 생성",
      },
      {
        name: "DDIMScheduler",
        what: "결정론적 샘플러",
        use: "얼굴 모델 권장 샘플러 — 안정적 결과로 교체(sde-dpmsolver++ 타입 지정)",
      },
      {
        name: "DPMSolverMultistepScheduler",
        what: "빠른 다단계 샘플러",
        use: "임포트만 — 실제로는 DDIM 설정을 씀",
      },
      {
        name: "PIL · numpy · matplotlib · tqdm · torchvision · clear_output · pathlib",
        what: "이미지·배열·플롯·진행바·변환 유틸",
        use: "얼굴 참조/생성 결과 격자 시각화에 보조로",
      },
    ],
  },
  // 1 — SD1.5 파이프라인 로드
  "본체 SD1.5를 float16으로 올리고 스케줄러를 DDIM 계열로 설정해(algorithm_type='sde-dpmsolver++'). 공식 문서가 얼굴 모델엔 DDIM/Euler를 권장하는 이유는, 얼굴 정체성이 매 스텝 무작위성에 흔들리면 사람이 바뀌어 보이기 때문이야 — 안정적인 샘플러로 일관성을 잡는 거지. 아직 IP-Adapter는 안 붙은 순수 SD 상태야.",
  // 2 — 얼굴 IP-Adapter 로드 (full-face)
  {
    text: "얼굴 전용 IP-Adapter를 끼워. h94/IP-Adapter의 'ip-adapter-full-face_sd15'는 잘라낸 얼굴 이미지로 특화 학습돼서, 일반 어댑터보다 눈·코·윤곽 같은 정체성 단서를 훨씬 정확히 옮겨와(더 강한 정체성이 필요하면 InsightFace 임베딩을 쓰는 FaceID 계열을 쓰기도 해). 이 어댑터가 '이 얼굴'을 cross-attention으로 UNet에 주입할 통로야.",
    diagram: {
      title: "얼굴 IP-Adapter 정체성 주입",
      kind: "architecture",
      summary: `flowchart TD
  FACE["얼굴 사진"] --> ENC["얼굴 특화 인코더<br/>(full-face)"]
  ENC --> IPCA["이미지 cross-attn<br/>(정체성)"]
  TXT["프롬프트<br/>(셰프·복장·화풍)"] --> TCA["텍스트 cross-attn"]
  IPCA -->|"× scale"| SUM(("합산"))
  TCA --> SUM
  SUM --> U["얼린 UNet"]
  U --> O["같은 얼굴, 다른 장면"]`,
      detail: `flowchart TD
  FACE["mohan_face.jpg"] --> ENC["full-face 이미지 인코더"]
  ENC --> PROJ["projection → 얼굴 토큰"]
  PROJ --> KIV["K_face, V_face"]
  TXT["prompt + negative → CLIP"] --> KTV["K_txt, V_txt"]
  Q["UNet 쿼리"] --> AT["attn(Q, K_txt) + scale·attn(Q, K_face)"]
  KTV --> AT
  KIV --> AT
  AT --> U["얼린 UNet 블록"]
  U --> N["노이즈 예측 → DDIM"]`,
    },
  },
  // 3 — 얼굴 정체성 생성 (셰프 프롬프트)
  "정체성 유지를 실제로 돌려봐. set_ip_adapter_scale(0.4)로 '얼굴은 적당히, 장면은 프롬프트대로'의 균형을 잡고, 프롬프트로 '프랑스 식당에서 앞치마 두르고 요리하는 셰프'를 주면서 ip_adapter_image=얼굴을 함께 넣어 5장을 뽑아. negative_prompt로 해부학 오류·저화질을 억눌러. 결과는 전부 같은 인물인데 셰프가 된 모습 — 사진 한 장으로 사람을 임의의 상황에 넣는, 개인화 아바타/프로필 생성의 핵심 동작이야.",
  // 4 — 얼굴 scale 스윕
  "얼굴을 얼마나 강하게 닮게 할지(set_ip_adapter_scale)를 0.1→0.9로 훑어. 낮으면 프롬프트(셰프 장면)가 지배해 인물 닮음이 옅어지고, 높이면 얼굴에 딱 붙되 장면 표현이 줄어들어. 얼굴 IP-Adapter는 보통 0.4~0.6이 단맛 구간이야 — 정체성과 연출의 균형. 시드를 0으로 고정해 scale 효과만 깨끗이 비교해.",
  // 5 — 프롬프트 목록 정의
  "이번엔 정체성은 고정하고 '화풍/연출'만 바꿔볼 거라 프롬프트 5개를 미리 정의해 — 영화적 인물사진, 하이패션 매거진, 수채화 일러스트, 사이버펑크 네온, 인상주의 유화. 같은 얼굴을 완전히 다른 미감으로 렌더링하는 변주 세트야. 이 셀은 리스트만 만들고 생성은 다음 셀에서 해.",
  // 6 — 화풍 스윕 생성
  {
    text: "같은 얼굴에 5가지 화풍을 입혀 뽑아. 매 장 set_ip_adapter_scale(0.5)로 정체성과 화풍을 반반 절충하고, 프롬프트만 바꿔가며 ip_adapter_image=얼굴을 일정하게 넣어 — 시드(0)도 고정해서 '화풍 차이'만 깨끗이 드러나게 해. 결과는 한 사람이 영화·매거진·수채화·사이버펑크·유화로 변신한 시리즈야. 이게 캐릭터 일관성(character consistency)의 실전 가치 — 웹툰·게임·브랜드 캠페인에서 한 인물을 여러 스타일로 변주하되 '같은 사람'이라는 정체성은 절대 안 깨지게 유지하는 거야.",
    diagram: {
      title: "정체성 고정 · 화풍 변주",
      kind: "algorithm",
      summary: `flowchart TD
  F["얼굴 사진 (고정)"] --> IP["full-face IP-Adapter<br/>scale=0.5"]
  P["프롬프트 5종 (화풍)"] --> LOOP["프롬프트마다 1장"]
  IP --> LOOP
  LOOP --> O["같은 얼굴 ×5 화풍"]`,
      detail: `flowchart TD
  F["mohan_face.jpg"] --> ENC["얼굴 인코더 → 정체성 K/V"]
  P["prompts[i] (영화·매거진·수채화·사이버펑크·유화)"] --> GEN["pipeline(prompt=prompts[i])"]
  ENC -->|"scale=0.5"| GEN
  SEED["manual_seed(0) 고정"] --> GEN
  NEG["negative_prompt (artifacts 억제)"] --> GEN
  GEN --> STEP["DDIM ×30"]
  STEP --> O["i번째 결과"]
  O --> NEXT{"다음 프롬프트?"}
  NEXT -->|"예"| GEN
  NEXT -->|"아니오"| GRID["5장 격자 비교"]`,
    },
  },
];

export default explanations;
