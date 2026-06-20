import type { Part } from "@/models/curriculum";
import { COURSE_PLAYLIST_URL } from "@/data/constants";

// The 10-part curriculum. Korean concept summaries are authored here because
// the course notebooks are code-heavy and carry almost no written theory.

export const CURRICULUM: Part[] = [
  {
    id: 1,
    slug: "simple-diffusion",
    title: "Simple Diffusion",
    titleKo: "기초 디퓨전",
    summary:
      "디퓨전 모델의 핵심 아이디어를 가장 단순한 2D 데이터로 익힌다. **forward process**(데이터에 조금씩 가우시안 노이즈를 더해 결국 순수 노이즈로 만드는 과정)와 **reverse process**(노이즈에서 출발해 신경망이 노이즈를 조금씩 걷어내며 데이터를 복원하는 과정)를 직접 구현한다. 모델은 각 단계에서 더해진 노이즈를 예측하도록(noise/ε-prediction) 학습되고, DDPM의 noise schedule(β, α)이 timestep마다 노이즈 양을 결정한다. 마지막엔 조건부 생성으로 원하는 클래스의 샘플을 만든다.",
    concepts: [
      "Forward / Reverse process",
      "Noise schedule (β, α)",
      "ε-prediction (노이즈 예측)",
      "Timestep 임베딩",
      "Conditional generation",
    ],
    notebooks: [
      { id: "part_1_simple_diffusion__diffusion_process", label: "디퓨전 프로세스 (2D 데모)" },
    ],
    videos: [
      { title: "디퓨전 생성모델 입문", url: "https://youtu.be/QrZ7u29ITtw" },
      { title: "조건부 생성", url: "https://youtu.be/OE3KFv1zyUs" },
    ],
    overview: {
      hook: "디퓨전의 심장은 의외로 단순해 — '노이즈를 더했다가, 그걸 되돌리는 법'을 배우는 거야. 가장 작은 2D 점들로 그 핵심만 딱 떼어 본다.",
      oneLine: "데이터에 노이즈를 단계적으로 더하고(forward), 신경망이 그 노이즈를 예측해 거꾸로 걷어내(reverse) 새 데이터를 만든다.",
      prereqs: [],
      unlocks: "이 forward/reverse 원리가 이후 모든 파트의 뼈대. 바로 다음 Part 2에서 똑같은 걸 진짜 이미지(MNIST)로 확장한다.",
      bigPicture: `flowchart LR
  D["데이터 (2D 점)"] -->|"forward: 노이즈를 조금씩 더해"| N["순수 노이즈"]
  N -->|"reverse: 모델이 노이즈를 예측해 걷어내"| G["복원·생성된 데이터"]`,
    },
  },
  {
    id: 2,
    slug: "mnist-diffusion",
    overview: {
      hook: "2D 점으로 원리는 잡았지? 이제 진짜 이미지 차례야 — 손글씨 숫자(MNIST)를 같은 방식으로 생성해. 그리고 바닥부터 짠 코드와 라이브러리 코드를 나란히 놓고 '추상화가 뭘 감추고 있는지' 두 눈으로 본다.",
      oneLine: "Part 1의 forward/reverse를 실제 이미지로 확장 — U-Net 디노이저와 DDPM 루프를 순수 PyTorch로 짜고, 같은 걸 Hugging Face diffusers로 재현한다.",
      prereqs: [1],
      unlocks: "diffusers의 UNet2DModel·DDPMScheduler를 다룰 줄 알게 돼, 다음 Part 3부터는 이 도구로 얼굴 같은 더 복잡한 분포를 학습한다.",
      bigPicture: `flowchart LR
  S["순수 PyTorch<br/>U-Net + DDPM 루프"] -->|"같은 결과를 적은 코드로"| H["diffusers<br/>UNet2DModel · DDPMScheduler"]
  S -.->|"추상화가 감싼 내부 이해"| H
  H --> G["MNIST 숫자 생성"]`,
    },
    title: "MNIST Diffusion",
    titleKo: "MNIST 디퓨전",
    summary:
      "2D 장난감 데이터에서 실제 이미지(MNIST 손글씨)로 확장한다. 먼저 **순수 PyTorch**로 U-Net 디노이저와 DDPM 학습 루프를 바닥부터 구현해 내부 동작을 완전히 이해하고, 다음으로 Hugging Face **diffusers**(UNet2DModel, DDPMScheduler)로 같은 일을 훨씬 적은 코드로 재현한다. 직접 구현 ↔ 라이브러리 대조를 통해 diffusers의 추상화가 무엇을 감싸고 있는지 드러낸다.",
    concepts: [
      "U-Net 디노이저",
      "DDPM 학습 루프",
      "UNet2DModel",
      "DDPMScheduler",
      "Sampling (역확산)",
    ],
    notebooks: [
      { id: "part_2_mnist_diffusion__part_2_1_diffusion_from_scratch_pytorch", label: "순수 PyTorch 구현" },
      { id: "part_2_mnist_diffusion__part_2_2_huggingface_diffusers", label: "Diffusers 라이브러리" },
    ],
    videos: [
      { title: "순수 PyTorch", url: "https://youtu.be/Zm1MekFAjto" },
      { title: "Diffusers 라이브러리", url: "https://youtu.be/_dgp2q-YyOQ" },
    ],
  },
  {
    id: 3,
    slug: "celeb-faces",
    overview: {
      hook: "숫자는 쉬웠어. 사람 얼굴은 분포가 훨씬 복잡하고 이미지도 커 — VRAM이 모자라기 시작한다. 작은 GPU로 큰 모델을 굴리는 '실전 학습 기술'이 여기서 등장해.",
      oneLine: "얼굴 같은 복잡한 분포를 scratch부터 학습하며, gradient accumulation·학습 중 샘플링·체크포인트 같은 실전 학습 테크닉을 익힌다.",
      prereqs: [2],
      unlocks: "큰 이미지를 안정적으로 학습하는 법을 손에 넣어, 다음 Part 5에서 바로 이 얼굴 데이터를 잠재 공간(LDM)으로 압축해 더 효율적으로 학습한다.",
      bigPicture: `flowchart LR
  D["셀럽 얼굴 데이터"] --> T["scratch 학습"]
  GA["gradient accumulation<br/>(작은 배치 → 큰 배치 효과)"] --> T
  T -->|"step별 샘플 모니터링"| R["runs/ — 또렷해지는 얼굴"]`,
    },
    title: "Celeb Faces",
    titleKo: "셀럽 얼굴 생성",
    summary:
      "사람 얼굴처럼 더 복잡한 분포를 scratch부터 학습한다. 큰 이미지·작은 VRAM 환경을 위한 실전 학습 테크닉이 핵심이다: **gradient accumulation**(작은 배치를 모아 큰 배치 효과 내기), 학습 중 주기적 샘플 생성으로 진행 모니터링, 체크포인트·평가 스텝 설정. runs/ 폴더의 step별 생성 이미지로, 학습이 진행될수록 얼굴이 또렷해지는 과정을 눈으로 확인한다.",
    concepts: [
      "Scratch 학습",
      "Gradient accumulation",
      "학습 모니터링 / 샘플링",
      "체크포인트",
      "데이터 전처리",
    ],
    notebooks: [
      { id: "part_3_diffusion_celeb_faces__part_3_1_celeb_face", label: "셀럽 얼굴 scratch 학습" },
    ],
    videos: [{ title: "셀럽 얼굴 파인튜닝", url: "https://youtu.be/05yjbi-ySR4" }],
  },
  {
    id: 4,
    slug: "image-editing",
    overview: {
      hook: "지금까지는 노이즈에서 '새로' 만들었지. 그런데 이미 있는 이미지의 일부만 고치고 싶다면? forward/reverse를 부분적으로만 쓰면 '생성'이 '편집'으로 바뀐다.",
      oneLine: "학습된 디퓨전 모델을 편집에 활용 — 마스크 영역만 노이즈→복원하는 inpainting과, 디퓨전 과정에서 이미지를 합치는 compositing.",
      prereqs: [1, 3],
      unlocks: "부분·단계적 노이즈 주입이라는 편집의 열쇠를 익혀, 나중에 Part 6에서 텍스트 조건과 결합해 '프롬프트로 지정한 부분만 고치는' inpainting으로 이어진다.",
      bigPicture: `flowchart LR
  I["원본 이미지"] --> M["마스크 영역만<br/>부분 노이즈 주입"]
  M -->|"reverse로 그 부분만 복원"| E["편집된 이미지<br/>(나머지는 보존)"]
  I --> C["여러 이미지 합성<br/>(compositing)"]`,
    },
    title: "Image Editing",
    titleKo: "이미지 편집",
    summary:
      "이미 학습된 디퓨전 모델을 '생성'이 아니라 '편집'에 쓴다. **Inpainting**은 마스크 영역만 노이즈→복원해 그 부분만 자연스럽게 다시 그리고 나머지는 보존한다. **image compositing**은 서로 다른 이미지를 디퓨전 과정에서 합성한다. 노이즈를 부분적으로·단계적으로 주입하는 아이디어가 편집의 열쇠다.",
    concepts: [
      "Inpainting",
      "마스크(mask)",
      "부분 노이즈 주입",
      "이미지 합성 (compositing)",
      "편집 강도 (strength)",
    ],
    notebooks: [
      { id: "part_4_image_editing_with_diffusion__part_4_1_inpainiting", label: "인페인팅" },
      { id: "part_4_image_editing_with_diffusion__part_4_2_image_compositing", label: "이미지 합성" },
    ],
    videos: [{ title: "이미지 편집", url: "https://youtu.be/RwgzDtmSC5g" }],
  },
  {
    id: 5,
    slug: "latent-diffusion",
    overview: {
      hook: "Part 3에서 큰 얼굴 이미지 학습이 얼마나 비쌌는지 느꼈지? 픽셀을 직접 다루지 말고, VAE로 작게 압축한 '잠재 공간'에서 디퓨전하면 계산량이 확 준다. 이게 바로 Stable Diffusion의 토대야.",
      oneLine: "VAE로 이미지를 저차원 latent로 압축한 뒤 그 잠재 공간에서 디퓨전하고, 마지막에 디코더로 이미지를 복원한다.",
      prereqs: [3],
      unlocks: "Stable Diffusion의 뼈대를 갖춰, 다음 Part 6부터 이 latent 위에서 텍스트(CLIP)·구조(ControlNet)·스타일(IP-Adapter) 조건화를 차례로 얹는다.",
      bigPicture: `flowchart LR
  X["이미지 (픽셀)"] -->|"VAE 인코더"| Z["latent (저차원)"]
  Z -->|"잠재 공간에서 디퓨전"| Z2["디노이즈된 latent"]
  Z2 -->|"VAE 디코더"| Y["복원·생성된 이미지"]`,
    },
    title: "Latent Diffusion (LDM)",
    titleKo: "잠재 공간 디퓨전",
    summary:
      "픽셀 공간에서 직접 디퓨전하면 비싸다. **VAE**로 이미지를 저차원 **latent**로 압축한 뒤 그 잠재 공간에서 디퓨전을 수행하고, 마지막에 디코더로 이미지를 복원한다. 이것이 Stable Diffusion의 토대다. 계산량이 크게 줄어 더 큰 데이터·해상도를 다룰 수 있다(학습률·평가 주기 등 LDM에 맞춘 설정 포함).",
    concepts: [
      "Latent space",
      "VAE 인코더 / 디코더",
      "Latent에서의 디퓨전",
      "압축률 (downsampling)",
      "Stable Diffusion 토대",
    ],
    notebooks: [
      { id: "part_5_latent_diffusion_model__part_5_1_ldm_on_celeb_faces", label: "LDM — 셀럽 얼굴" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
  {
    id: 6,
    slug: "text-conditioning",
    overview: {
      hook: "이제 latent 위에서 디퓨전할 줄 알지. 근데 아직 '아무거나' 생성될 뿐이야 — 원하는 걸 말로 시키고 싶잖아. 텍스트 프롬프트로 생성을 조종하는 순간 진짜 Stable Diffusion이 된다.",
      oneLine: "CLIP 텍스트 인코더가 프롬프트를 임베딩으로 바꾸고, U-Net의 cross-attention이 그걸 보며 생성을 조건화 — CFG로 프롬프트 충실도를 조절한다.",
      prereqs: [5],
      unlocks: "텍스트 조건화와 cross-attention 구조를 이해하면, 다음 Part 7(ControlNet)·8(IP-Adapter)·9(LoRA)에서 이 SD1.5 파이프라인에 구조·스타일·커스텀 개념을 얹을 수 있다.",
      bigPicture: `flowchart LR
  P["텍스트 프롬프트"] -->|"CLIP 인코더"| E["텍스트 임베딩"]
  E -->|"cross-attention"| U["U-Net (latent 디퓨전)"]
  U --> I["조건에 맞는 이미지"]
  C["CFG 강도"] -->|"프롬프트 충실도 조절"| U`,
    },
    title: "Text Conditioning",
    titleKo: "텍스트 조건화",
    summary:
      "텍스트 프롬프트로 이미지를 제어한다. **CLIP 텍스트 인코더**가 프롬프트를 임베딩으로 바꾸고, U-Net의 **cross-attention**이 그 임베딩을 보며 생성을 조건화한다. text-to-image뿐 아니라 img2img·inpainting을 SD1.5로 실습한다. **classifier-free guidance**(CFG)로 프롬프트 충실도를 조절하는 것이 핵심.",
    concepts: [
      "CLIP 텍스트 인코더",
      "Cross-attention",
      "Classifier-free guidance (CFG)",
      "img2img",
      "Prompt / Negative prompt",
    ],
    notebooks: [
      { id: "part_6_SD_text_conditioning__part_6_1_text_conditioning", label: "텍스트 조건화" },
      { id: "part_6_SD_text_conditioning__part_6_2_SD15_inpainting_img2img", label: "SD1.5 inpaint / img2img" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
  {
    id: 7,
    slug: "controlnet",
    overview: {
      hook: "프롬프트로 '뭘' 그릴지는 정했어. 근데 '어떤 구도·포즈로'는 말로 콕 집기 힘들지. ControlNet은 엣지·깊이·골격 같은 구조를 직접 그림처럼 입력해 형태를 정밀하게 잡아준다.",
      oneLine: "사전학습 SD를 고정한 채 추가 분기로 구조적 조건(Canny 엣지·depth·OpenPose 골격)을 주입해 형태·포즈를 정밀 제어한다.",
      prereqs: [6],
      unlocks: "고정된 SD에 조건 분기를 붙이는 패턴을 익혀, 다음 Part 8에서 IP-Adapter(이미지 조건)와 결합해 구조와 스타일을 동시에 제어한다.",
      bigPicture: `flowchart LR
  P["텍스트 프롬프트"] --> SD["사전학습 SD (고정)"]
  M["구조 조건<br/>Canny · Depth · OpenPose"] -->|"ControlNet 분기"| SD
  SD --> I["구도·포즈가 통제된 이미지"]`,
    },
    title: "ControlNet",
    titleKo: "ControlNet",
    summary:
      "텍스트만으로는 구도를 정확히 통제하기 어렵다. **ControlNet**은 사전학습 SD를 고정한 채, 추가 분기로 **구조적 조건**(Canny 엣지, depth, **OpenPose** 골격 등)을 주입해 형태·포즈를 정밀 제어한다. 여러 ControlNet을 동시에 거는 **multi-ControlNet**까지 다룬다.",
    concepts: [
      "ControlNet 구조",
      "Conditioning map (Canny / Depth)",
      "OpenPose",
      "Multi-ControlNet",
      "Conditioning scale",
    ],
    notebooks: [
      { id: "part_7_controlnet__part_7_1_controlnet", label: "ControlNet" },
      { id: "part_7_controlnet__part_7_2_open_pose_multi_controlnet", label: "OpenPose multi-ControlNet" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
  {
    id: 8,
    slug: "ip-adapter",
    overview: {
      hook: "'이 느낌으로 그려줘'를 말로 다 설명하기 어려울 때 있지? 그냥 참조 이미지를 보여주면 돼. IP-Adapter는 텍스트 대신 이미지를 프롬프트로 써서, 파인튜닝 없이 그 스타일·콘텐츠를 가져온다.",
      oneLine: "참조 이미지를 임베딩해 cross-attention에 더함으로써, 별도 학습 없이 '이 이미지 느낌으로' 생성하게 한다.",
      prereqs: [6, 7],
      unlocks: "이미지 조건을 cross-attention에 주입하는 법을 익혀, ControlNet(구조)과 결합해 구조+스타일을 동시에 잡고 face adapter로 특정 인물 얼굴까지 유지한다.",
      bigPicture: `flowchart LR
  R["참조 이미지"] -->|"이미지 임베딩"| A["IP-Adapter"]
  A -->|"cross-attention에 주입"| SD["SD (선택적으로 ControlNet 결합)"]
  P["텍스트 프롬프트"] --> SD
  SD --> I["참조 스타일을 입은 이미지"]`,
    },
    title: "IP-Adapter",
    titleKo: "IP-Adapter (이미지 프롬프트)",
    summary:
      "텍스트 대신 **이미지를 프롬프트로** 쓴다. **IP-Adapter**는 참조 이미지의 스타일·콘텐츠를 임베딩해 cross-attention에 더해, 별도 파인튜닝 없이 '이 이미지 느낌으로' 생성하게 한다. ControlNet과 결합해 구조+스타일을 동시에 제어하고, **face IP-Adapter**로 특정 인물 얼굴을 유지하는 응용까지 다룬다.",
    concepts: [
      "IP-Adapter",
      "Image prompt",
      "이미지 임베딩 주입",
      "ControlNet 결합",
      "Face adapter (얼굴 유지)",
    ],
    notebooks: [
      { id: "part_8_ipadapters__part_8_1_ipadapter", label: "IP-Adapter" },
      { id: "part_8_ipadapters__part_8_2_ipadapter_controlnet", label: "IP-Adapter + ControlNet" },
      { id: "part_8_ipadapters__part_8_3_face_ipadapter", label: "Face IP-Adapter" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
  {
    id: 9,
    slug: "lora-finetuning",
    overview: {
      hook: "Part 8까지는 SD를 '있는 그대로' 조종했어. 그런데 모델이 아예 모르는 새 개념·스타일을 가르치려면? 전체를 다시 학습하는 건 너무 비싸. LoRA는 작은 가중치만 얹어 싸고 빠르게 가르친다.",
      oneLine: "가중치에 저랭크(low-rank) 행렬만 추가로 학습하는 PEFT 기법 — 남의 LoRA를 불러와 적용하고, 내 데이터로 직접 파인튜닝한다.",
      prereqs: [6],
      unlocks: "적은 비용으로 SD에 새 개념을 주입하는 법을 익혀, 무거워진 커스텀 파이프라인을 다음 Part 10에서 더 빠르고 가볍게 최적화한다.",
      bigPicture: `flowchart LR
  SD["사전학습 SD (고정)"] --> O["출력"]
  L["LoRA<br/>저랭크 행렬만 학습"] -->|"가중치에 더함"| O
  D["내 데이터 (예: platypus)"] -->|"파인튜닝"| L`,
    },
    title: "LoRA Fine-tuning",
    titleKo: "LoRA 파인튜닝",
    summary:
      "전체 모델을 다시 학습하지 않고 적은 비용으로 새 개념·스타일을 가르친다. **LoRA**는 가중치에 저랭크(low-rank) 행렬만 추가로 학습하는 **PEFT** 기법이라 파일이 작고 빠르다. 남이 만든 LoRA를 불러와 적용하는 법, 그리고 내 데이터(예: platypus 이미지셋)로 직접 LoRA를 파인튜닝하는 법을 모두 실습한다. negative embedding 활용도 등장.",
    concepts: [
      "LoRA (저랭크 적응)",
      "PEFT",
      "LoRA 로드 / 병합",
      "커스텀 파인튜닝",
      "Negative embedding",
    ],
    notebooks: [
      { id: "part_9_LoRA_finetuning__part_9_1_load_lora", label: "LoRA 불러오기" },
      { id: "part_9_LoRA_finetuning__part_9_2_finetuning_diffusion", label: "LoRA 파인튜닝" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
  {
    id: 10,
    slug: "inference-optimization",
    overview: {
      hook: "여기까지 오면 멋진 이미지는 만들 수 있어. 근데 한 장에 수십 스텝, VRAM도 빵빵해야 하지. 마지막은 '같은 품질을 더 빠르고 가볍게' — 실제로 쓸 수 있게 만드는 단계야.",
      oneLine: "LCM 증류로 샘플링을 4~8 스텝으로 줄이고, 양자화로 가중치를 저정밀도화해 VRAM을 절감 — 속도↔품질↔메모리 트레이드오프를 실측한다.",
      prereqs: [5, 6],
      unlocks: "추론을 실전 배포 수준으로 최적화하는 법을 익히며 커리큘럼을 마무리 — 작은 GPU에서도 빠르게 도는 디퓨전 파이프라인을 손에 넣는다.",
      bigPicture: `flowchart LR
  B["기본 SD 추론<br/>수십 스텝 · 큰 VRAM"] -->|"LCM 증류"| F["4~8 스텝 샘플링"]
  B -->|"양자화 (저정밀도)"| V["VRAM 절감"]
  F --> R["빠르고 가벼운 추론"]
  V --> R`,
    },
    title: "Inference Optimization",
    titleKo: "추론 최적화",
    summary:
      "생성을 더 빠르고 가볍게 만든다. **LCM**(Latent Consistency Model)은 증류를 통해 4~8 스텝 만에 샘플링(원래는 수십 스텝)해 추론을 극적으로 단축한다. **양자화**(quantization)는 가중치를 저정밀도로 바꿔 **VRAM**을 줄여 작은 GPU에서도 돌게 한다. 품질 ↔ 속도 ↔ 메모리 트레이드오프를 실측한다.",
    concepts: [
      "LCM (Consistency Model)",
      "Step 수 감소",
      "Quantization (양자화)",
      "VRAM 절감",
      "속도 / 품질 트레이드오프",
    ],
    notebooks: [
      { id: "part_10_inference_optimization__part_10_1_LCM", label: "LCM" },
      { id: "part_10_inference_optimization__part_10_2_quantization_less_VRAM", label: "양자화 (VRAM 절감)" },
    ],
    videos: [{ title: "강의 재생목록", url: COURSE_PLAYLIST_URL }],
  },
];

export const PART_BY_SLUG: Record<string, Part> = Object.fromEntries(
  CURRICULUM.map((p) => [p.slug, p]),
);
