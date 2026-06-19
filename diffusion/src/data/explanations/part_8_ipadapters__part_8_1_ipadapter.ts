// Part 8.1 IP-Adapter 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports
  {
    text: "연장통부터 펼쳐. IP-Adapter는 '이미지를 프롬프트처럼' 쓰게 해주는 가벼운 모듈이야 — 텍스트는 텍스트 cross-attention으로, 참조 이미지는 따로 분리된(decoupled) cross-attention으로 UNet에 넣어서, 말로 표현하기 힘든 스타일·외형을 그림 한 장으로 지시해. 여기선 그걸 붙일 SD1.5 파이프라인부터 준비하려고 도구를 꺼내.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·시드",
        use: "float16 로드, device 선택, manual_seed로 변형 시드 고정",
      },
      {
        name: "diffusers.utils.load_image",
        what: "이미지 로더",
        use: "이미지 프롬프트(woman.png 등)와 보조 이미지를 불러와",
      },
      {
        name: "diffusers.StableDiffusionPipeline",
        what: "기본 text-to-image 파이프라인",
        use: "여기에 load_ip_adapter로 IP-Adapter를 끼워 이미지 프롬프트 생성",
      },
      {
        name: "DDIMScheduler",
        what: "결정론적 샘플러",
        use: "IP-Adapter(특히 얼굴/스타일)에 권장돼 — 안정적 결과로 교체",
      },
      {
        name: "DPMSolverMultistepScheduler",
        what: "빠른 다단계 샘플러",
        use: "임포트만 — 이 노트북에선 DDIM을 주로 씀",
      },
      {
        name: "PIL · numpy · matplotlib · tqdm · torchvision · clear_output · pathlib",
        what: "이미지·배열·플롯·진행바·변환 유틸",
        use: "참조/생성 이미지 표시와 격자 비교에 보조로",
      },
    ],
  },
  // 1 — SD1.5 파이프라인 로드
  "이미지 프롬프트를 받을 본체부터 올려. SD1.5를 float16으로 불러오고 스케줄러를 DDIM으로 갈아끼워. DDIM은 매 스텝 무작위성을 안 넣는 결정론적 샘플러라 IP-Adapter 결과가 들쭉날쭉하지 않고 안정적이야(공식 문서도 얼굴/스타일엔 DDIM·Euler를 권장해). 아직 IP-Adapter는 안 붙였고, 순수 SD 상태야.",
  // 2 — IP-Adapter 가중치 로드 (plus)
  {
    text: "이제 SD에 IP-Adapter를 끼워. h94/IP-Adapter 저장소에서 'ip-adapter-plus_sd15' 가중치를 불러와. plus 변형은 이미지를 한 덩어리 토큰이 아니라 여러 patch 임베딩으로 잘게 쪼개 ViT-H 인코더로 인코딩해서, 일반 버전보다 디테일(질감·구도)을 훨씬 풍부하게 옮겨와. 파일이 ~100MB로 작은 이유는 UNet 본체는 그대로고 '이미지→cross-attention' 투영 가중치만 들었기 때문이야.",
    diagram: {
      title: "IP-Adapter 분리형 cross-attention",
      kind: "architecture",
      summary: `flowchart TD
  IMG["이미지 프롬프트"] --> ENC["이미지 인코더<br/>(ViT-H/CLIP)"]
  ENC --> IPCA["이미지 cross-attn<br/>(새로 추가·학습)"]
  TXT["텍스트 프롬프트"] --> TCA["텍스트 cross-attn<br/>(얼림)"]
  IPCA --> SUM(("합산"))
  TCA --> SUM
  SUM --> U["얼린 UNet"]
  U --> O["생성 이미지"]`,
      detail: `flowchart TD
  IMG["ip_adapter_image"] --> ENC["image encoder<br/>(plus: patch 임베딩 + ViT-H)"]
  ENC --> PROJ["projection → 이미지 토큰"]
  PROJ --> KIV["K_img, V_img (학습된 to_k/to_v)"]
  TXT["prompt → CLIP 텍스트 임베딩"] --> KTV["K_txt, V_txt (얼림)"]
  Q["UNet 쿼리 Q"] --> A1["attn(Q, K_txt, V_txt)"]
  Q --> A2["attn(Q, K_img, V_img)"]
  KTV --> A1
  KIV --> A2
  A2 -->|"× scale"| ADD(("+"))
  A1 --> ADD
  ADD --> U["얼린 UNet 블록"]`,
    },
  },
  // 3 — 이미지 변형 생성 (prompt='')
  "텍스트 없이 이미지만으로 변형을 만들어봐. set_ip_adapter_scale(1.0)으로 '온전히 이미지 프롬프트만 따르라'고 못박고, prompt=''에 guidance_scale=1(텍스트 안내 끔), ip_adapter_image=참조 이미지로 5장을 뽑아. 같은 사람의 분위기·옷·구도를 유지한 채 미묘하게 다른 변형들이 나와 — '이 이미지 같은 느낌'을 양산하는 거야. 이게 IP-Adapter의 가장 순수한 동작: 그림 한 장이 곧 프롬프트.",
  // 4 — IP-Adapter scale 스윕
  "이미지를 얼마나 강하게 따를지(set_ip_adapter_scale)를 0.2→1.8로 훑어. 낮으면 참조를 살짝만 참고해 자유롭게 변형되고(1.0이 '이미지에만 의존'), 높이면(>1.0) 참조에 과하게 매달려 점점 뭉개지기도 해. 이 다이얼이 '이미지 충실도'의 핵심 조절기야 — 실전에선 보통 0.4~0.8 사이에서 텍스트와 이미지의 균형점을 찾아 써. 시드를 0으로 고정해 scale 효과만 깨끗이 비교해.",
  // 5 — img2img 파이프라인(from_pipe)
  "이번엔 IP-Adapter를 img2img에 붙여. 이미 만든 파이프라인 부품을 from_pipe로 그대로 재활용해 StableDiffusionImg2ImgPipeline을 만들어(모델 재로드 없이 메모리 공유). img2img는 '시작 이미지(base)'에서 출발하니까, 'base의 구도 위에 + 참조 이미지의 스타일'을 합성하는 셋업이야.",
  // 6 — 두 이미지 로드 + 표시
  "두 장을 불러와 역할을 나눠. river.png는 IP-Adapter에 줄 '스타일/내용 프롬프트 이미지', vermeer.jpg는 img2img가 출발점으로 삼을 '베이스 이미지'야. 둘을 나란히 그려서 각각 무슨 역할인지 확인해 — 다음 셀에서 '베르메르 그림의 구도에 강물 사진의 느낌을 입히는' 합성을 할 거야.",
  // 7 — img2img + IP-Adapter (시드 스윕)
  "베이스 이미지(베르메르) 위에 참조 이미지(강물)의 느낌을 입혀 5장을 뽑아. image=베이스, ip_adapter_image=참조(256으로 축소), strength=0.6으로 '베이스를 60%쯤 갈아엎되 나머지 구도는 살려'라고 지시하고 set_ip_adapter_scale(1.0)으로 참조를 강하게 반영해. 시드만 0~4로 바꿔 변형을 만들어 — '같은 합성 레시피, 다른 결과'를 보는 거야.",
  // 8 — img2img strength 스윕
  "이번엔 시드 고정하고 strength(0.2→0.8)만 훑어. strength는 '베이스 이미지를 얼마나 보존할지 vs 새로 그릴지'야 — 낮으면 베르메르 원본 구도가 많이 남고, 높으면 거의 새 그림이 되며 참조 스타일이 더 지배해. tqdm 스텝 수도 strength에 비례해 늘어. 베이스 충실도와 스타일 주입의 줄다리기를 한 줄 격자로 비교해.",
  // 9 — 인페인트 파이프라인(from_pipe)
  "세 번째 조합: IP-Adapter를 인페인팅에 붙여. from_pipe로 StableDiffusionInpaintPipeline을 만들어 부품을 재활용해. 인페인트는 '마스크 친 영역만 다시 그리기'니까, 곧 '얼굴 영역만 참조 인물로 교체' 같은 작업을 할 셋업이야 — 사진 합성·얼굴 스왑 워크플로우의 토대.",
  // 10 — 인페인트용 IP-Adapter (full-face) 로드
  "인페인트 파이프라인에는 'ip-adapter-full-face_sd15' 가중치를 끼워. 이 변형은 잘라낸 얼굴 이미지에 특화돼 학습돼서, 일반 IP-Adapter보다 얼굴 디테일(눈·코·윤곽)을 훨씬 정확히 옮겨와. 마스크 영역에 특정 인물의 얼굴을 심어야 하니, 얼굴 전용 어댑터로 바꾸는 거야.",
  // 11 — 인페인트 이미지 + 마스크 로드
  "인페인팅 재료를 불러와. image.png(다시 그릴 원본 장면)와 mask.png(어디를 바꿀지 가리키는 흑백 마스크)를 (512,768)로 맞춰 불러오고 나란히 표시해. 흰 영역이 '여기를 새 얼굴로 채워', 검은 영역이 '원본 보존'이야. 마스크 모양을 눈으로 확인하는 단계.",
  // 12 — 얼굴 프롬프트 이미지 로드
  "마스크 자리에 심을 인물 얼굴(mohan_face.jpg)을 256으로 축소해 불러와 표시해. 이게 IP-Adapter에 줄 '이 얼굴로 그려'의 참조 이미지야 — full-face 어댑터가 이 얼굴의 정체성을 마스크 영역에 옮겨 넣을 거야.",
  // 13 — 인페인트 + 얼굴 IP-Adapter 생성
  {
    text: "마스크 친 영역에 참조 얼굴을 심어 5장을 뽑아. set_ip_adapter_scale(0.6)으로 얼굴 정체성과 장면의 자연스러움을 절충하고, image=원본·mask_image=마스크·ip_adapter_image=얼굴·strength=0.6으로 '마스크 안쪽만 이 얼굴로 새로 그려'를 실행해. 마스크 밖은 원본 그대로 보존돼. 이게 IP-Adapter의 대표적 실전 응용 — 얼굴 스왑/정체성 유지 합성이야. 영화 후반작업·개인화 아바타·증명사진 생성에서 이 방식으로 특정 인물을 다양한 장면에 일관되게 넣어.",
    diagram: {
      title: "IP-Adapter 얼굴 인페인팅",
      kind: "algorithm",
      summary: `flowchart TD
  B["원본 장면"] --> P["inpaint 파이프라인"]
  M["마스크"] --> P
  F["참조 얼굴"] --> IP["full-face IP-Adapter"]
  IP --> P
  P --> O["마스크 영역만<br/>참조 얼굴로 교체"]`,
      detail: `flowchart TD
  B["image (512×768)"] --> P["inpaint(...)"]
  M["mask_image"] --> P
  F["face.jpg (256)"] --> ENC["full-face 이미지 인코더"]
  ENC --> KIV["이미지 cross-attn (얼굴)"]
  KIV -->|"scale=0.6"| P
  S["strength=0.6"] --> P
  P --> LOOP["마스크 안쪽만 디노이즈<br/>(밖은 원본 잠재 유지)"]
  LOOP --> O["seed 0..4 변형 5장"]`,
    },
  },
];

export default explanations;
