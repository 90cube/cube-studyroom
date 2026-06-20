// Part 6.2 SD1.5 파이프라인 — text2img · img2img · inpaint. 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "이번 노트북의 목표는 '같은 SD1.5 부품 한 벌로 세 가지 작업(글→그림, 그림→그림, 부분 다시 그리기)을 다 한다'야. 그래서 연장통엔 SD 부품들(VAE·UNet·CLIP)과 세 종류의 파이프라인 재료를 꺼내. 부품은 하나, 작업은 셋 — 이게 diffusers 파이프라인 설계의 묘미야.",
    imports: [
      {
        name: "AutoencoderKL",
        what: "이미지↔latent 압축/복원 VAE",
        use: "세 파이프라인 모두 공유하는 압축기 — latent를 픽셀로 decode",
      },
      {
        name: "UNet2DConditionModel",
        what: "텍스트 조건 받는 노이즈 예측 U-Net",
        use: "세 작업의 공통 엔진. 텍스트 임베딩 받아 매 스텝 노이즈 예측",
      },
      {
        name: "DPMSolverMultistepScheduler",
        what: "적은 스텝에 강한 고차 솔버",
        use: "sde-dpmsolver++ 모드로 셋 모두에서 빠르고 선명한 디노이즈",
      },
      {
        name: "StableDiffusionPipeline",
        what: "글→그림(text2img) 완성 파이프라인",
        use: "prompt만으로 새 이미지 생성",
      },
      {
        name: "CLIPTokenizer · CLIPTextModel",
        what: "문장→토큰→의미벡터 변환기",
        use: "프롬프트를 (77,768) 조건 임베딩으로 — 모든 파이프라인이 내부에서 사용",
      },
      {
        name: "PIL.Image",
        what: "이미지 열기/리사이즈",
        use: "img2img·inpaint에 넣을 원본 사진과 마스크를 준비",
      },
      {
        name: "torch · tqdm · matplotlib · numpy",
        what: "텐서·진행바·표시·배열",
        use: "고정 latent 생성, 진행 표시, 결과 비교 표시, 마스크 배열 계산",
      },
    ],
  },
  // 1 — load all SD1.5 components
  {
    text: "SD1.5 체크포인트에서 부품을 서브폴더별로 따로 불러와 장치에 올려 — vae·unet·tokenizer·text_encoder, 그리고 스케줄러는 DPMSolver++로. 앞 노트북과 같은 분해 로딩인데, 이번엔 이 한 벌을 세 파이프라인이 돌려쓸 거라 따로 들고 있는 게 더 중요해. text_encoder 구조를 출력해 768차원 CLIP인지 확인해.",
    diagram: {
      title: "공유 부품 1벌 로드",
      kind: "architecture",
      summary: `flowchart TD
  ID["SD1.5 model_id"] --> V["vae"]
  ID --> U["unet"]
  ID --> T["tokenizer + text_encoder (768d)"]
  ID --> S["scheduler: DPMSolver++ (sde)"]
  SHARE["이 한 벌을 text2img·img2img·inpaint가 공유"] -.-> U`,
    },
  },
  // 2 — text2img pipeline with fixed latents
  {
    text: "첫 작업: 글→그림. 부품들을 StableDiffusionPipeline에 꽂아. 이번엔 시작 노이즈 latent를 직접 만들어(seed 42 고정) 파이프라인에 latents=로 넘겨줘 — 이러면 매번 똑같은 출발점에서 시작하니 결과가 재현돼. negative_prompt=''(무조건)와 guidance_scale=7.5로 'A cat'을 50스텝 생성해 띄워. 고정 latent를 쓰는 건 다음 작업들과 공정하게 비교하거나, 같은 그림을 미세조정할 때 유용한 실무 습관이야.",
    diagram: {
      title: "text2img (고정 latent)",
      kind: "algorithm",
      summary: `flowchart TD
  A["seed 42 → latents (1,4,64,64)"] --> B["StableDiffusionPipeline"]
  B --> C["prompt='A cat', neg='', guidance 7.5"]
  C --> D["50스텝 디노이즈 → decode"]
  D --> E["재현 가능한 고양이 이미지"]`,
    },
  },
  // 3 — build img2img pipeline from same parts
  {
    text: "두 번째 작업: 그림→그림. 새 모델을 또 받는 게 아니라, 똑같은 부품(vae·unet·tokenizer·text_encoder·scheduler)을 StableDiffusionImg2ImgPipeline에 그대로 꽂아 재사용해. 메모리에 모델 한 벌만 올려두고 작업 종류만 바꾸는 거야 — GPU가 한정된 실무 환경에서 핵심적인 패턴이지. 아직 실행은 안 하고 파이프라인 객체만 만들어둬.",
    diagram: {
      title: "부품 재사용 → img2img 파이프라인",
      kind: "architecture",
      summary: `flowchart TD
  PARTS["기존 부품 한 벌<br/>vae·unet·tokenizer·te·scheduler"] --> I2I["StableDiffusionImg2ImgPipeline"]
  NOTE["모델 재로드 없음 — 같은 가중치 공유"] -.-> I2I`,
    },
  },
  // 4 — load the source image
  "img2img에 넣을 원본 사진을 불러와. dt_hair.png를 512×512로 맞추고 RGB로 바꿔서 띄워봐. 이 사람 사진이 출발점이고, 다음 셀에서 프롬프트로 머리색만 바꿔볼 거야.",
  // 5 — img2img: change hair color with strength 0.2
  {
    text: "그림→그림 실행. img2img_pipe에 원본 image와 프롬프트 'a man with neon green hair'를 주고, 핵심 다이얼인 strength=0.2로 돌려. strength는 '원본을 얼마나 갈아엎을지'야 — 0.2면 원본에 노이즈를 살짝(20%)만 입히고 거기서부터 복원하니, 얼굴·구도는 그대로 두고 머리색 같은 디테일만 프롬프트대로 바뀌어. (내부적으론 50스텝 중 20%인 약 10스텝만 실제로 도는 거라 빠르기도 해.) strength를 키우면 원본에서 점점 멀어지고, 1에 가까우면 거의 새 그림이 돼. 원본과 결과를 나란히 띄워 변화를 확인해. 이 'strength로 보존↔변형 조절'이 실무에서 제품 사진 리터칭·색 변경·배경 교체에 그대로 쓰이는 SDEdit 방식이야. (보라색 줄 hover 참고.)",
    lines: {
      2: "image=원본 사진이 출발점. text2img와 달리 순수 노이즈가 아니라 이 그림에서 시작.",
      3: "★strength=0.2 = 원본에 노이즈를 20%만 입힘 → 50스텝 중 ≈10스텝만 실제 디노이즈. 0이면 원본 유지, 1이면 새 그림.",
    },
    diagram: {
      title: "img2img (strength = 변형 강도)",
      kind: "algorithm",
      summary: `flowchart TD
  A["원본 + 'neon green hair'"] --> B["strength=0.2"]
  B --> C["원본에 20%만 노이즈"]
  C --> D["≈10스텝만 디노이즈"]
  D --> E["구도·얼굴 유지 · 머리색만 변경"]
  NOTE["strength↑ → 원본에서 멀어짐 (1≈완전 새 그림)"] -.-> B`,
    },
  },
  // 6 — build inpaint pipeline via from_pipe
  {
    text: "세 번째 작업: 부분만 다시 그리기(inpaint). 여기서도 새로 안 받아 — StableDiffusionInpaintPipeline.from_pipe(img2img_pipe)로 방금 img2img 파이프라인의 부품을 그대로 물려받아 인페인트용으로 변신시켜. from_pipe는 '같은 모델, 다른 작업'을 메모리 낭비 없이 갈아끼우는 diffusers의 공식 손잡이야. 출력으로 파이프라인 구성(scheduler·unet·vae 등)이 그대로 이어진 걸 확인해.",
    diagram: {
      title: "from_pipe로 inpaint 파이프라인 파생",
      kind: "architecture",
      summary: `flowchart TD
  I2I["img2img_pipe (부품 보유)"] --> FP["from_pipe(...)"]
  FP --> INP["StableDiffusionInpaintPipeline"]
  NOTE["같은 가중치 재사용 — 작업만 inpaint로 전환"] -.-> INP`,
    },
  },
  // 7 — load reference image + build a soft mask
  {
    text: "인페인트에 쓸 원본과 마스크를 준비해. 사진(dt.png)을 얼굴 위주로 crop하고 512×512로 맞춰. 그다음 마스크: 512×512 검은 판(전부 0)에서 위쪽 200줄만 1로 칠해 — 여기가 '다시 그릴 영역'(머리 부분)이야. gaussian_filter(sigma=10)로 경계를 부드럽게 번지게 해서 이음매가 티 안 나게 하고, 0~255 흑백 이미지로 변환해. 원본 위에 마스크를 반투명으로 겹쳐 띄워서 어디를 새로 칠할지 눈으로 확인해. (이 마스크가 곧 모델한테 '여기만 건드려'라고 알려주는 지도야. 보라색 줄 hover 참고.)",
    lines: {
      5: "전부 0인 검은 판 = '아무 데도 안 건드림'에서 출발.",
      6: "위쪽 200줄(행)만 1로 = '여기를 다시 그려'. 1=교체 영역, 0=보존 영역.",
      7: "gaussian_filter(σ=10)로 0↔1 경계를 흐릿하게 — 교체부와 원본 이음매를 부드럽게.",
      8: "0~1 마스크를 0~255 흑백 PIL 이미지로 변환 — 파이프라인이 받는 형식.",
    },
    diagram: {
      title: "인페인트 마스크 만들기",
      kind: "algorithm",
      summary: `flowchart TD
  A["검은 판 512×512 (0)"] --> B["위쪽 200줄 = 1<br/>여기를 다시 그림(머리)"]
  B --> C["gaussian_filter σ=10<br/>경계 부드럽게"]
  C --> D["0~255 흑백 마스크 이미지"]
  D --> E["원본 위에 겹쳐 영역 확인"]`,
    },
  },
  // 8 — inpaint: regenerate the masked region with a prompt
  {
    text: "인페인트 실행. inpaint_pipe에 원본 image·mask_image·프롬프트 'black dark hair, jay z'를 주고 strength=0.6, guidance 7.5로 돌려. 동작은 이래: 마스크가 1인 영역(머리)만 프롬프트대로 새로 생성하고, 0인 영역(얼굴·배경)은 원본 그대로 보존해 — 매 스텝 원본을 같은 노이즈 레벨로 끼워넣어 이음매 없이 합쳐(Part 4.1의 RePaint 방식과 같은 골격이고, diffusers가 내부에서 자동 처리). strength=0.6은 마스크 영역을 꽤 과감하게 바꾸겠다는 뜻이라 머리 스타일/색이 확실히 달라져. 원본+마스크와 결과를 나란히 띄워 비교해. 이 '지정한 부분만 텍스트로 교체'가 실무에서 사진 보정(머리·옷·배경 일부 교체), 제품 이미지에서 결함만 지우기, 워터마크 제거 같은 데 핵심으로 쓰여. (보라색 줄 hover 참고.)",
    lines: {
      3: "★mask_image=mask — img2img와의 결정적 차이. 마스크=1만 새로 그리고 0은 원본 보존.",
      4: "strength=0.6 = 마스크 영역을 꽤 과감하게 변형(img2img의 0.2보다 큼) → 머리 스타일까지 확 바뀜.",
    },
    diagram: {
      title: "텍스트 기반 인페인트 (마스크 영역만 교체)",
      kind: "algorithm",
      summary: `flowchart TD
  A["원본 + 마스크 + 'jay z hair'"] --> B["inpaint_pipe (strength=0.6)"]
  B --> C["마스크=1 영역: 프롬프트대로 재생성"]
  B --> D["마스크=0 영역: 원본 보존"]
  C --> E["매 스텝 원본 끼워넣어 이음매 없이 합성"]
  D --> E
  E --> F["머리만 바뀌고 얼굴·배경 유지"]`,
      detail: `flowchart TD
  REF["ref_image 512×512"] --> CALL["inpaint_pipe(prompt, image=ref, mask_image=mask, strength=0.6, guidance=7.5, steps=50)"]
  MASK["soft mask (머리=1)"] --> CALL
  CALL --> GEN["마스크 영역만 텍스트 조건으로 디노이즈"]
  GEN --> KEEP["비마스크는 원본 latent로 매 스텝 복원·블렌드"]
  KEEP --> OUT["합성 결과 (이음매 부드러움 ← σ=10 마스크)"]
  USE["응용: 사진 보정·결함 제거·워터마크 삭제·옷/배경 교체"] -.-> OUT`,
    },
  },
];

export default explanations;
