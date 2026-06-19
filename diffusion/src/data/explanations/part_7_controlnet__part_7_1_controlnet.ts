// Part 7.1 ControlNet 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + Canny ControlNet 파이프라인 로드
  {
    text: "연장통부터 펼치고 바로 ControlNet 파이프라인을 조립해. ControlNet은 SD 본체는 그대로 얼린 채, 옆에 작은 복사본을 붙여서 '구조 힌트'(여기선 Canny 외곽선)를 따라가게 만드는 어댑터야. 'control_v11p_sd15_canny' 가중치를 float16으로 불러와 SD1.5에 끼우고, 스케줄러는 빠른 UniPC로 갈아끼워. safety_checker=None은 연구용으로 필터를 끈 거야(공개 서비스엔 켜둬).",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU 연산",
        use: "dtype(float16) 지정, device 선택, manual_seed로 생성 시드 고정",
      },
      {
        name: "diffusers.utils.load_image",
        what: "URL/경로에서 이미지를 PIL로 불러오는 헬퍼",
        use: "Canny를 뽑을 원본 참조 이미지(새 사진)를 가져와",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 라이브러리",
        use: "PIL 이미지를 배열로 바꿔 cv2.Canny에 넘기고, 1채널 엣지를 3채널로 쌓아(concatenate)",
      },
      {
        name: "cv2 (OpenCV)",
        what: "컴퓨터 비전 라이브러리",
        use: "cv2.Canny로 원본에서 외곽선(엣지 맵)을 추출 — 이게 ControlNet의 구조 조건이 돼",
      },
      {
        name: "PIL.Image",
        what: "이미지 객체",
        use: "엣지 배열을 다시 PIL 이미지(control_image)로 되돌려 파이프라인에 입력",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "그래프·이미지 표시",
        use: "원본·엣지·생성 결과를 나란히 subplot으로 비교",
      },
      {
        name: "ControlNetModel",
        what: "구조 조건을 받아 UNet에 잔차를 주입하는 ControlNet 본체",
        use: "from_pretrained로 canny 체크포인트를 로드해 파이프라인에 끼움",
      },
      {
        name: "StableDiffusionControlNetPipeline",
        what: "SD + ControlNet을 묶은 text-to-image 파이프라인",
        use: "프롬프트 + control_image를 함께 받아 구조를 따르는 이미지를 생성",
      },
      {
        name: "UniPCMultistepScheduler",
        what: "적은 스텝으로도 잘 수렴하는 빠른 샘플러",
        use: "기본 스케줄러를 교체해 20스텝 내외로 빠르게 생성",
      },
    ],
  },
  // 1 — Canny 엣지 맵 준비 + 시각화
  "원본 사진에서 ControlNet이 따라갈 '구조 지도'를 만들어. 512×512로 맞춘 뒤 cv2.Canny로 외곽선만 뽑아(임계값 100/200). 엣지는 흑백 1채널이라, 같은 걸 3번 쌓아 RGB 3채널로 만들어줘야 모델이 받는다. 이 control_image가 곧 '윤곽은 이대로, 내용은 프롬프트대로'의 그 윤곽이야. 원본과 엣지 맵을 나란히 그려서 확인해.",
  // 2 — 단일 생성
  "이제 실제로 생성시켜. '정글 속 파란 극락조'라고 프롬프트를 주고, 방금 만든 Canny 엣지를 image로 넘겨. ControlNet이 매 디노이징 스텝마다 '이 외곽선을 벗어나지 마'라고 UNet을 잡아주니까, 원본과 똑같은 실루엣인데 완전히 다른 대상이 나와. 시드를 33으로 고정해 재현 가능하게 하고, 원본·엣지·결과 셋을 비교해.",
  // 3 — 여러 프롬프트로 같은 구조 재활용
  "같은 엣지 맵을 고정해두고 프롬프트만 5개로 바꿔 돌려봐(빨강·노랑·검정·흰 극락조…). 구조(자세·윤곽)는 똑같이 유지되면서 색·분위기만 갈아끼워지는 걸 5×3 격자로 보여줘. 이게 ControlNet의 핵심 실전 패턴이야 — 한 장의 레이아웃을 잡아두고 수십 가지 변주를 뽑는 거. 제품 컷·캐릭터 시트를 이런 식으로 양산해.",
  // 4 — ControlNet 강도(conditioning scale) 스윕
  {
    text: "ControlNet을 얼마나 세게 따를지(controlnet_conditioning_scale)를 0.1→1.0으로 훑어. 값이 낮으면 외곽선을 느슨하게 참고해 프롬프트가 더 자유롭게 날뛰고, 높으면 윤곽에 딱 붙어. 이 다이얼이 '구조 충실도 vs 창의성'의 균형추야. 참고로 QR Code Monster 같은 응용에선 이 값을 높여 '스캔되는 QR'을, 낮춰 '예술적인 QR'을 만들어.",
    diagram: {
      title: "ControlNet 조건 주입 흐름",
      kind: "architecture",
      summary: `flowchart TD
  C["구조 입력<br/>Canny 엣지"] --> CN["ControlNet<br/>(SD 인코더 복사본)"]
  P["텍스트 프롬프트"] --> U["얼린 SD UNet"]
  CN -->|"scale × 잔차"| U
  U --> O["생성 이미지<br/>윤곽 따름 + 내용은 프롬프트"]`,
      detail: `flowchart TD
  C["control_image (3ch)"] --> EMB["conditioning embedding<br/>(conv 다운샘플)"]
  EMB --> CN["ControlNet 복사 인코더"]
  CN --> ZD["zero-conv ×12<br/>down 잔차"]
  CN --> ZM["zero-conv mid 잔차"]
  P["prompt → CLIP 임베딩"] --> U["얼린 UNet"]
  ZD -->|"× scale"| U
  ZM -->|"× scale"| U
  U --> N["노이즈 예측"]
  N --> STEP["scheduler.step → x_t−1"]
  STEP --> O["디코드 → 이미지"]`,
    },
  },
  // 5 — Inpaint 파이프라인 로드
  {
    text: "이번엔 ControlNet을 '인페인팅'(이미지 일부만 다시 그리기)에 붙여. 같은 canny ControlNet을 StableDiffusionControlNetInpaintPipeline에 끼워. 인페인트는 원본 + 마스크 + 구조조건 셋을 같이 받아서, 마스크 친 영역만 새로 칠하되 그 자리의 외곽선은 유지해. 사진의 한 부분만 교체하는 리터칭·합성 워크플로우의 기본형이야.",
    imports: [
      {
        name: "StableDiffusionControlNetInpaintPipeline",
        what: "SD + ControlNet 인페인팅 파이프라인",
        use: "원본·마스크·control_image를 받아 마스크 영역만 구조를 지키며 새로 생성",
      },
    ],
  },
  // 6 — 마스크 + Canny 동시 준비
  "인페인팅에 쓸 두 가지를 준비해. (1) 아까처럼 Canny 엣지(control_image), (2) '여기만 새로 그려'를 가리키는 마스크. 마스크는 0으로 깐 배열에 사각 영역만 1로 채우고, gaussian_filter로 경계를 부드럽게 번지게 해 — 그래야 교체 부위와 원본이 자연스럽게 이어져. 원본·엣지·마스크 오버레이를 나란히 확인해.",
  // 7 — Inpaint 단일 생성
  "마스크 친 영역에 '빨간 극락조'를 새로 그려넣어. image=원본, mask_image=마스크, control_image=엣지를 한꺼번에 넘기면, 모델이 마스크 안쪽만 다시 칠하되 Canny 윤곽을 따라가. 마스크 밖은 원본 그대로 보존돼. 원본·엣지·마스크·결과 4장을 비교해서 '딱 그 부분만' 바뀐 걸 확인해.",
  // 8 — Inpaint strength 스윕
  "인페인트의 strength(0.1→1.0)를 훑어. strength는 '원본을 얼마나 갈아엎을지'야 — 낮으면 원본 흔적이 많이 남아 살짝만 손대고, 높으면 마스크 영역을 거의 백지에서 새로 그려. tqdm 진행 막대의 스텝 수가 strength에 비례해 늘어나는 것도 보여(실제 디노이징 구간이 그만큼 길어지니까). 리터칭 강도를 취향대로 고르는 다이얼이야.",
  // 9 — 컴포넌트 분해용 imports
  {
    text: "여기서부터는 파이프라인 뚜껑을 열어 ControlNet이 안에서 뭘 하는지 직접 본다. 파이프라인 대신 부품(VAE·UNet·텍스트 인코더·토크나이저·스케줄러·ControlNet)을 따로 불러올 준비로 도구를 꺼내. device와 dtype(float16)도 여기서 정해둬.",
    imports: [
      {
        name: "AutoencoderKL · UNet2DConditionModel",
        what: "VAE(잠재↔픽셀)와 노이즈 예측 UNet",
        use: "잠재를 이미지로 디코드, 그리고 노이즈 예측 본체로 직접 호출",
      },
      {
        name: "DDIMScheduler · UniPCMultistepScheduler",
        what: "샘플링 스케줄러들",
        use: "수동 디노이징 루프에서 timestep 관리와 step 계산에 사용",
      },
      {
        name: "transformers.CLIPTextModel · CLIPTokenizer",
        what: "텍스트 인코더와 토크나이저",
        use: "프롬프트를 토큰화하고 임베딩으로 인코딩해 cross-attention 조건으로 넘김",
      },
      {
        name: "ControlNetModel · StableDiffusionControlNetPipeline",
        what: "ControlNet 본체 + 참고용 파이프라인",
        use: "ControlNet을 직접 forward 호출해 down/mid 잔차를 뽑아봄",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "진행률 표시줄",
        use: "수동 디노이징 루프의 스텝 진행을 막대로 표시",
      },
      {
        name: "torchvision.transforms · PIL · pathlib · clear_output",
        what: "이미지 변환·경로·출력 갱신 유틸",
        use: "중간 결과를 애니메이션처럼 갱신 표시할 때 보조로",
      },
    ],
  },
  // 10 — 부품 개별 로드
  "파이프라인을 안 쓰고 부품을 하나씩 직접 불러. SD1.5에서 vae·unet·tokenizer·text_encoder·scheduler를 subfolder별로 꺼내 각각 device에 올리고, canny ControlNetModel도 따로 로드해. 셀을 실행하면 ControlNet 구조가 통째로 출력되는데 — conv_in, controlnet_cond_embedding(구조 입력 다운샘플러), down_blocks(UNet 인코더 복사본), 그리고 핵심인 controlnet_down_blocks/controlnet_mid_block(전부 1×1 conv = 'zero convolution')이 보여. 이 zero-conv가 학습 초기에 0에서 시작해 본체를 망가뜨리지 않으면서 점점 조건을 주입하는 장치야.",
  // 11 — ControlNet 단일 forward + UNet 잔차 주입
  {
    text: "ControlNet이 뱉는 게 정확히 뭔지 한 번 호출해봐. 랜덤 잠재(1,4,64,64)와 프롬프트 임베딩, 그리고 구조 조건 이미지를 ControlNet에 넣으면 down_block_res_samples(리스트)와 mid_block_res_sample(하나)이 나와. 이걸 그대로 UNet에 down_block_additional_residuals·mid_block_additional_residual로 꽂아주면, UNet이 노이즈를 예측할 때 각 해상도 층마다 구조 힌트가 더해져. 이게 '얼린 UNet + 외부 잔차 주입'이라는 ControlNet의 작동 원리 그 자체야.",
    diagram: {
      title: "ControlNet → UNet 잔차 주입",
      kind: "algorithm",
      summary: `flowchart TD
  L["잠재 x_t"] --> CN["controlnet(...)"]
  E["텍스트 임베딩"] --> CN
  CI["구조 조건 이미지"] --> CN
  CN --> D["down 잔차 ×12"]
  CN --> M["mid 잔차"]
  L --> UN["unet(...)"]
  D --> UN
  M --> UN
  UN --> NP["노이즈 예측"]`,
      detail: `flowchart TD
  L["latent (1,4,64,64)"] --> CN["controlnet<br/>sample, timestep=10<br/>encoder_hidden_states<br/>controlnet_cond<br/>conditioning_scale=1.0"]
  CI["conditioning_image (1,3,512,512)"] --> CN
  E["text_embeddings (1,77,768)"] --> CN
  CN --> DR["down_block_res_samples<br/>(12개 텐서)"]
  CN --> MR["mid_block_res_sample"]
  L --> UN["unet<br/>down_block_additional_residuals=DR<br/>mid_block_additional_residual=MR"]
  E --> UN
  DR --> UN
  MR --> UN
  UN --> NP["noise_pred [0]"]`,
    },
  },
  // 12 — 잔차 shape 출력
  "방금 나온 잔차들의 모양을 찍어봐. down 잔차 12개가 (1,320,64,64)에서 시작해 점점 해상도가 줄고 채널이 늘어(…1280,8,8) — UNet 인코더의 각 다운샘플 단계와 정확히 짝이 맞아. mid 잔차는 (1280,8,8). 즉 ControlNet은 UNet의 모든 스킵 지점마다 같은 모양의 보정값을 만들어 끼워주는 구조라는 걸 숫자로 확인하는 셀이야.",
  // 13 — CFG용 프롬프트 임베딩 준비
  "수동 루프를 위해 프롬프트를 CFG(classifier-free guidance) 형태로 인코딩해. 진짜 프롬프트와 빈 프롬프트('') 둘을 함께 토큰화·인코딩해서 (2,77,768) 임베딩을 만들어. 나중에 '조건 있음'과 '조건 없음' 예측을 둘 다 구한 뒤 그 차이를 증폭시켜 프롬프트를 더 강하게 따르게 할 건데, 그 두 갈래를 한 배치로 미리 준비하는 거야.",
  // 14 — ControlNet 조건 이미지 전처리(CFG 배치)
  "ControlNet에 넣을 구조 이미지도 CFG 배치에 맞춰 준비해. VaeImageProcessor로 Canny 엣지를 정규화 없이(do_normalize=False) 전처리해 텐서로 만들고, CFG의 두 갈래(조건/무조건)에 똑같이 쓰려고 2배로 복제(torch.cat ×2)해. 잠재 배치(2)와 조건 배치(2)가 어긋나지 않게 줄을 맞추는 단계야.",
  // 15 — 수동 디노이징 루프
  {
    text: "이제 파이프라인 없이 디노이징 루프를 손으로 돌려. 순수 노이즈에서 시작해 20스텝 동안: 잠재를 2배로 복제(CFG) → ControlNet으로 구조 잔차를 뽑고(scale 0.8) → 그걸 UNet에 꽂아 노이즈를 예측 → 조건/무조건 예측을 분리해 guidance_scale 7.5로 증폭 → 스케줄러로 한 스텝 디노이즈. 5스텝마다 VAE로 디코드해 그림을 갱신하면, 노이즈가 점점 '외곽선을 따르는 그림'으로 정돈되는 과정이 눈에 보여. 파이프라인이 내부에서 매 스텝 하던 일을 그대로 펼쳐 쓴 거야.",
    diagram: {
      title: "수동 ControlNet 디노이징 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 잠재"] --> B["20스텝 반복"]
  B --> C["잠재 ×2 (CFG)"]
  C --> D["ControlNet → 구조 잔차"]
  D --> E["UNet → 노이즈 예측"]
  E --> F["CFG로 증폭"]
  F --> G["scheduler.step"]
  G --> B
  B --> H["VAE 디코드 → 이미지"]`,
      detail: `flowchart TD
  A["latents ~ N(0,I)"] --> B["t in timesteps"]
  B --> CAT["latent_model_inputs = cat(latents ×2)"]
  CAT --> CN["controlnet(scale=0.8)<br/>→ down/mid 잔차"]
  CN --> UN["unet(+잔차) → noise_pred"]
  UN --> SPLIT["chunk(2): text, uncond"]
  SPLIT --> G["pred = uncond + 7.5·(text − uncond)"]
  G --> ST["latents = scheduler.step(pred, t).prev_sample"]
  ST --> CK{"i mod 5 == 0 ?"}
  CK -->|"예"| DEC["VAE decode → 중간 미리보기"]
  CK -->|"아니오"| B
  DEC --> B
  B --> FIN["최종 VAE 디코드 → 결과 이미지"]`,
    },
  },
];

export default explanations;
