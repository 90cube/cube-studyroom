// Part 6.1 텍스트 조건화(text conditioning) — CLIP + classifier-free guidance. 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "본격적으로 Stable Diffusion을 부품 단위로 뜯어볼 차례야. 텍스트로 그림을 조종하려면 부품이 넷 필요해 — 압축기(VAE), 노이즈 예측기(UNet), 글자→토큰 변환기(CLIPTokenizer), 토큰→의미벡터 변환기(CLIPTextModel). 그 도구들을 미리 다 꺼내놓고 장치를 정해. 핵심은 CLIP이야: 글로 쓴 설명을 모델이 알아듣는 숫자(임베딩)로 바꿔주는 통역사 역할.",
    imports: [
      {
        name: "AutoencoderKL",
        what: "이미지↔latent 압축/복원 VAE",
        use: "마지막에 latent를 사람이 볼 픽셀 이미지로 decode",
      },
      {
        name: "UNet2DConditionModel",
        what: "텍스트 조건을 받는 노이즈 예측 U-Net",
        use: "매 스텝 encoder_hidden_states로 텍스트 임베딩을 받아 노이즈를 예측 — '조건부' 버전",
      },
      {
        name: "DDIMScheduler",
        what: "결정론적 디노이즈 스케줄러",
        use: "역확산 루프에서 한 스텝씩 latent를 깨끗하게(step)",
      },
      {
        name: "CLIPTokenizer",
        what: "문장을 토큰 ID 열로 자르는 도구",
        use: "프롬프트를 항상 77토큰 길이로 잘라/채워 숫자 ID로 변환",
      },
      {
        name: "CLIPTextModel",
        what: "토큰을 의미 벡터로 인코딩하는 트랜스포머",
        use: "토큰 ID를 (77, 768) 임베딩으로 — 이게 UNet에 먹일 '조건'",
      },
      {
        name: "torch",
        what: "PyTorch 텐서·GPU",
        use: "latent 노이즈 생성, no_grad 추론, 장치 이동 전반",
      },
      {
        name: "tqdm.auto.tqdm · matplotlib · clear_output",
        what: "진행바·이미지 표시·출력 갱신",
        use: "디노이즈 루프 진행 표시와 중간 결과를 애니메이션처럼 갱신",
      },
      {
        name: "numpy · pathlib · PIL · transforms · CLIPFeatureExtractor",
        what: "배열·경로·이미지 IO·전처리 보조 도구",
        use: "보조용 — 이 노트북 본류에선 가볍게 쓰이거나 import만",
      },
    ],
  },
  // 1 — load all SD1.5 components separately
  {
    text: "Stable Diffusion 1.5 체크포인트에서 부품을 따로따로 불러와. 한 폴더 안에 서브폴더로 vae·unet·tokenizer·text_encoder·scheduler가 나뉘어 있어서, subfolder를 지정해 각각 from_pretrained로 받아. 이렇게 분해해서 들고 있어야 나중에 파이프라인 없이 '손으로' 확산을 돌려볼 수 있어. text_encoder 구조를 출력해보면 12층짜리 CLIP 트랜스포머에 768차원 임베딩인 게 보여 — SD1.x가 쓰는 바로 그 사이즈야.",
    diagram: {
      title: "SD1.5 부품 4종 로드",
      kind: "architecture",
      summary: `flowchart TD
  ID["model_id (SD1.5)"] --> VAE["vae: AutoencoderKL"]
  ID --> UNET["unet: UNet2DConditionModel"]
  ID --> TOK["tokenizer: CLIPTokenizer"]
  ID --> TE["text_encoder: CLIPTextModel (768d, 12층)"]
  ID --> SCH["scheduler: DDIMScheduler"]`,
    },
  },
  // 2 — wrap in pipeline, generate "A cat" the easy way
  {
    text: "먼저 '쉬운 길'부터. 방금 부품들을 StableDiffusionPipeline에 그대로 꽂으면, 토큰화→인코딩→디노이즈→decode를 알아서 다 해주는 완성품이 돼. (safety_checker=None은 데모라 끈 거고, 공개 서비스에선 켜두는 게 원칙.) prompt='A cat'에 50스텝, guidance_scale=7.5로 한 장 뽑아 띄워봐 — 고양이가 나오면 부품 조립이 맞다는 뜻. 다음 셀부터는 이 파이프라인이 안에서 뭘 하는지 한 꺼풀씩 직접 벗겨볼 거야.",
    diagram: {
      title: "파이프라인 = 부품 조립 (쉬운 길)",
      kind: "architecture",
      summary: `flowchart TD
  P["StableDiffusionPipeline"] --> A["프롬프트 'A cat'"]
  A --> B["내부: 토큰화 → CLIP 인코딩"]
  B --> C["50스텝 디노이즈 (guidance 7.5)"]
  C --> D["VAE decode → 이미지"]`,
    },
  },
  // 3 — tokenize a prompt manually
  {
    text: "이제 '직접 하는 길'. 첫 단계는 토큰화야. tokenizer에 'A cat'을 주되 padding='max_length', max_length=77로 강제해 — 프롬프트가 짧든 길든 무조건 77토큰으로 맞추는 게 CLIP 규약이거든. 출력 input_ids의 shape이 (1, 77)인 걸 확인하고 내용을 찍어봐: 맨 앞 49406은 시작 토큰, 'a cat' 두 단어, 그리고 49407(끝/패딩 토큰)이 77칸을 다 채울 때까지 반복돼. 왜 항상 77이냐면, 모델이 고정 길이 텐서를 기대하기 때문이야.",
    diagram: {
      title: "프롬프트 토큰화 (항상 77토큰)",
      kind: "algorithm",
      summary: `flowchart TD
  A["'A cat'"] --> B["CLIPTokenizer<br/>padding='max_length', max=77"]
  B --> C["input_ids (1, 77)"]
  C --> D["49406(시작) · a · cat · 49407…(끝/패딩 반복)"]`,
    },
  },
  // 4 — encode tokens to text embeddings
  {
    text: "토큰 ID를 CLIP 텍스트 인코더에 통과시켜 진짜 '의미 벡터'로 바꿔. text_encoder(**tokenized).last_hidden_state를 받으면 (1, 77, 768) 텐서가 나와 — 토큰 77개 각각이 768차원 벡터로 표현된 거야. 이 텐서가 곧 UNet에 먹일 '조건(conditioning)'이고, 다음 셀에서 매 디노이즈 스텝마다 이걸 넣어줄 거야. no_grad로 감싼 건 학습이 아니라 추론이라 기울기가 필요 없어서.",
    diagram: {
      title: "토큰 → 텍스트 임베딩",
      kind: "algorithm",
      summary: `flowchart TD
  A["input_ids (1, 77)"] --> B["CLIPTextModel"]
  B --> C["last_hidden_state (1, 77, 768)"]
  C --> D["토큰별 768차원 의미 벡터<br/>= UNet에 줄 '조건'"]`,
    },
  },
  // 5 — manual diffusion loop WITHOUT guidance
  {
    text: "손으로 확산을 돌려봐 — 단, 아직 guidance는 없는 '맨몸' 버전. 순수 노이즈 latent(1×4×64×64)에서 출발해서 50스텝 거꾸로 내려와. 매 스텝의 핵심 한 줄은 unet(latents, t, encoder_hidden_states=text_embeddings) — 바로 여기 encoder_hidden_states로 텍스트 조건이 들어가고, UNet 안의 cross-attention 층들이 각 공간 위치에서 프롬프트 토큰을 '참조'해 가져다 써. 그게 텍스트가 그림을 조종하는 통로야. 5스텝마다 중간 latent를 VAE로 decode해 띄워서 노이즈가 점점 고양이로 모이는 과정을 지켜봐. 근데 이 맨몸 버전은 프롬프트를 느슨하게 따르는 경향이 있어 — 다음 셀에서 그걸 고쳐.",
    diagram: {
      title: "수동 디노이즈 (guidance 없음)",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 latent (1,4,64,64)"] --> B["50스텝 반복"]
  B --> C["noise_pred = unet(latents, t,<br/>encoder_hidden_states=임베딩)"]
  C --> D["cross-attention이 토큰 참조"]
  D --> E["scheduler.step → 한 칸 디노이즈"]
  E --> F["5스텝마다 VAE decode로 미리보기"]
  F --> B
  B --> G["고양이 latent 완성"]`,
    },
  },
  // 6 — tokenize prompt + empty string (for CFG)
  {
    text: "Classifier-free guidance를 쓰려면 프롬프트를 두 개 준비해야 해 — 진짜 프롬프트 'A cat'과 빈 문자열 ''. 빈 문자열은 '아무 조건 없음(unconditional)'을 뜻해. 두 개를 한 번에 토큰화하면 (2, 77)이 되고, CLIP에 통과시키면 (2, 77, 768) 임베딩이 나와. 윗줄은 '고양이 조건', 아랫줄은 '무조건'. 다음 셀에서 이 둘의 예측을 비교해 프롬프트 방향을 증폭할 거야.",
    diagram: {
      title: "조건 + 무조건 임베딩 짝 만들기",
      kind: "algorithm",
      summary: `flowchart TD
  A["['A cat', '']"] --> B["토큰화 (2, 77)"]
  B --> C["CLIP 인코딩 (2, 77, 768)"]
  C --> D["행0 = 고양이 조건<br/>행1 = 무조건(빈 텍스트)"]`,
    },
  },
  // 7 — CFG denoising loop
  {
    text: "이제 진짜 핵심, classifier-free guidance. 매 스텝 latent를 두 벌 복제해(torch.cat([latents]*2) → (2,4,64,64)) 한 번의 UNet 호출로 '조건부 예측'과 '무조건 예측'을 동시에 뽑아. 그다음 마법의 한 줄: noise_pred = uncond + scale·(text − uncond). 해석하면 '무조건이 기본값, 거기에 (조건−무조건)이라는 프롬프트 방향 벡터를 guidance_scale(7.5)배만큼 더 밀어준다'는 거야. 이러면 모델이 프롬프트를 훨씬 강하게 따라가 — 고양이를 시키면 확실히 고양이가 나와. scale을 키울수록 프롬프트 충실도↑(대신 과하면 인공적), 1이면 guidance 없음과 같아. 이게 거의 모든 텍스트→이미지 모델이 쓰는 표준 기법이야.",
    diagram: {
      title: "Classifier-Free Guidance 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["latent 복제 → (2,4,64,64)"] --> B["UNet 1회 호출"]
  B --> C["조건부·무조건 예측 동시 산출"]
  C --> D["chunk(2) → text, uncond"]
  D --> E["noise_pred = uncond + 7.5·(text − uncond)"]
  E --> F["scheduler.step → 한 칸 디노이즈"]
  F --> A`,
      detail: `flowchart TD
  L0["latents (1,4,64,64)"] --> CAT["latent_model_inputs = cat([latents]×2)"]
  CAT --> U["noise_pred = unet(inputs, t, hidden=임베딩(2,77,768))"]
  U --> CH["noise_pred_text, noise_pred_uncond = chunk(2)"]
  CH --> G["noise_pred = uncond + scale·(text − uncond)"]
  G --> S["latents = scheduler.step(noise_pred, t, latents).prev_sample"]
  S --> L0
  NOTE["scale↑ → 프롬프트 충실도↑ (과하면 인공적)<br/>scale=1 → guidance 없음"] -.-> G`,
    },
  },
  // 8 — re-tokenize for the better-scheduler run
  "스케줄러를 더 좋은 걸로 바꿔 다시 돌릴 준비. 임베딩이 앞 루프에서 그대로 살아있긴 하지만, 깔끔하게 'A cat'과 ''를 다시 토큰화·인코딩해 (2, 77, 768) 조건을 새로 준비해둬. 내용은 앞과 동일 — 다음 셀에서 새 스케줄러에 그대로 먹일 거야.",
  // 9 — swap scheduler to DPMSolver++ and run CFG again
  {
    text: "마지막으로 스케줄러를 업그레이드해. DDIM 대신 DPMSolverMultistepScheduler(sde-dpmsolver++)로 바꾸면, 같은 50스텝(혹은 더 적은 스텝)으로도 더 선명하고 안정적인 결과를 얻어 — 고차 ODE/SDE 솔버라 적은 스텝에서 효율이 좋거든. 나머지 루프는 앞의 CFG와 똑같아: latent 복제 → 두 예측 → uncond + scale·(text−uncond) → step. 단 이 솔버는 확률적(sde) 성분이 있어 step에 generator를 넘겨 재현성을 챙겨. 핵심 교훈은 '부품을 갈아끼우는 자유'야 — UNet·VAE·CLIP은 그대로 두고 스케줄러만 바꿔도 품질·속도가 달라져. 실무에선 이 스케줄러 선택이 생성 속도와 품질을 튜닝하는 첫 번째 다이얼이야.",
    diagram: {
      title: "스케줄러 교체 (DPMSolver++)",
      kind: "algorithm",
      summary: `flowchart TD
  A["scheduler = DPMSolverMultistep<br/>(sde-dpmsolver++)"] --> B["set_timesteps(50)"]
  B --> C["CFG 루프 (앞과 동일)"]
  C --> D["uncond + 7.5·(text − uncond)"]
  D --> E["step(..., generator) ← 재현성"]
  E --> C
  C --> F["같은 스텝수 · 더 선명한 결과"]`,
    },
  },
];

export default explanations;
