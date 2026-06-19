// Part 5.1 잠재 확산 모델(LDM) — VAE로 latent 만들기. 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통부터 펼쳐. 이번 주제는 '픽셀 공간이 아니라 압축된 잠재(latent) 공간에서 확산을 돌리자'는 LDM이야. 그래서 신경망(torch)·VAE/UNet(diffusers는 아래 셀에서)·시각화 도구를 꺼내고, 맨 끝에서 GPU가 잡히는지 확인해 출력해. 잠재 공간을 쓰는 이유는 곧 메모리 실험으로 직접 보게 될 거야.",
    imports: [
      {
        name: "torch · torch.nn · F",
        what: "PyTorch — 텐서 연산·신경망·함수형 연산",
        use: "U-Net/VAE를 장치에 올리고, 노이즈 텐서 만들고, no_grad 추론까지 전부",
      },
      {
        name: "torchvision",
        what: "이미지 변환·데이터셋 유틸",
        use: "뒤에서 transforms로 얼굴 이미지를 512×512 텐서로 전처리",
      },
      {
        name: "numpy (np)",
        what: "수치 배열 계산",
        use: "바탕 계산용 — 직접 호출은 적고 torch가 안에서 활용",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "이미지·곡선 표시",
        use: "메모리-해상도 곡선, latent 시각화, 원본 vs VAE 복원 비교를 그려",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "진행률 표시줄",
        use: "반복 작업 진행 표시(이 노트북에선 보조적으로)",
      },
      {
        name: "sklearn (cluster, datasets, mixture)",
        what: "고전 ML 도구 모음",
        use: "import만 — 이 노트북에선 실사용 거의 없음(템플릿 잔재)",
      },
      {
        name: "seaborn (sns)",
        what: "예쁜 통계 그래프",
        use: "보조 시각화용으로 꺼내둠",
      },
      {
        name: "clear_output · time",
        what: "출력 갱신·시간 유틸",
        use: "애니메이션식 갱신이 필요할 때 이전 그림 지우고 딜레이 주기",
      },
    ],
  },
  // 1 — build a pixel-space UNet (3ch) and print it
  {
    text: "비교 기준으로 '픽셀에서 바로 도는' U-Net을 하나 세워. 입출력 3채널(RGB), 64×64 기준 샘플 크기에 다운/업블록을 쌓고 일부 단계엔 어텐션(AttnDownBlock 등)을 넣어. num_class_embeds=2는 클래스 조건 2종을 받겠다는 뜻. 만들고 eval()로 추론 모드 박은 뒤 구조를 출력해 — 다음 셀들에서 이 픽셀용 모델이 메모리를 얼마나 먹는지 재고, 나중에 latent용(4채널)과 대조할 거야.",
    diagram: {
      title: "픽셀 공간 U-Net (3채널)",
      kind: "architecture",
      summary: `flowchart TD
  IN["입력 RGB 3채널"] --> CONV["conv_in → 64채널"]
  CONV --> DOWN["다운블록 ×4<br/>64→128→160→224 (어텐션 포함)"]
  DOWN --> MID["중간 어텐션 블록"]
  MID --> UP["업블록 ×4<br/>다시 64채널로"]
  UP --> OUT["conv_out → RGB 3채널 (예측 노이즈)"]`,
    },
  },
  // 2 — count parameters
  "이 모델이 얼마나 큰지 학습 가능한 파라미터 수를 세서 출력해(약 1,760만 개). requires_grad가 켜진 텐서들의 원소 수를 전부 더하는 한 줄이야 — 모델 '덩치'를 숫자로 확인하는 거지.",
  // 3 — peak GPU memory vs input resolution
  {
    text: "여기가 LDM의 동기를 보여주는 핵심 실험이야. 같은 픽셀용 U-Net에 64·128·256·512 해상도를 차례로 넣어보고, 각 경우 GPU 최대 메모리(peak)를 재서 곡선으로 그려. 결과를 보면 해상도가 2배 되면 메모리가 대략 4배씩 폭증해 — 512에서 벌써 1GB를 넘어. 픽셀 공간에서 고해상도를 직접 다루는 게 왜 비싼지가 그래프 한 장에 박혀. 그래서 LDM의 발상: '이미지를 작게 압축해놓고 거기서 확산을 돌리자.' 다음 셀부터 그 압축기(VAE)를 데려와.",
    diagram: {
      title: "메모리 ∝ 해상도² (LDM 동기)",
      kind: "algorithm",
      summary: `flowchart TD
  A["해상도 64·128·256·512"] --> B["각 해상도로 U-Net 1회 추론"]
  B --> C["torch.cuda.max_memory_allocated 측정"]
  C --> D["곡선 그리기"]
  D --> E["해상도 ×2 → 메모리 ≈ ×4<br/>512는 1GB 초과"]
  E --> F["결론: 압축된 latent에서 확산하자"]`,
    },
  },
  // 4 — load pretrained VAE (AutoencoderKL) and print
  {
    text: "압축기를 데려와. Stable Diffusion 1.5가 쓰는 VAE(AutoencoderKL)를 사전학습 가중치로 불러와 장치에 올리고 구조를 출력해. 이 녀석은 두 부분이야 — Encoder는 512×512 이미지를 8배 줄여 64×64로 압축하고, Decoder는 그걸 다시 512×512로 복원해. 핵심은 '의미는 보존하면서 공간 크기만 1/8로 줄인다'는 점. 출력 구조를 보면 conv_out이 8채널인데(평균·분산 합쳐서), 실제 latent는 4채널이야.",
    diagram: {
      title: "VAE(AutoencoderKL) 구조",
      kind: "architecture",
      summary: `flowchart TD
  IMG["이미지 512×512×3"] --> ENC["Encoder<br/>8배 다운샘플"]
  ENC --> LAT["latent 64×64×4<br/>(공간 1/8 압축)"]
  LAT --> DEC["Decoder<br/>8배 업샘플"]
  DEC --> REC["복원 이미지 512×512×3"]`,
    },
  },
  // 5 — load celeb dataset
  "실험용 얼굴 데이터를 가져와. Hugging Face Datasets로 tmdb-celeb-10k(연예인 사진 1만 장) 학습 분할을 통째로 불러와 ds에 담아. 다음 셀들에서 여기서 몇 장 꺼내 VAE에 통과시킬 거야.",
  // 6 — peek one image
  "데이터가 멀쩡한지 67번 샘플 하나를 512×512로 키워서 그냥 띄워봐. 어떤 사진들이 들어있는지 눈으로 확인하는 한 줄이야.",
  // 7 — transform first 5 images into a tensor batch
  "앞에서 5장(0~4번)을 꺼내 VAE 입력용으로 전처리해. 각 이미지를 512×512로 맞추고 텐서화한 뒤 −1~1로 정규화(VAE가 학습 때 보던 범위)하고, torch.stack으로 (5, 3, 512, 512) 배치 한 덩어리로 쌓아 장치에 올려. shape을 찍어 5장이 제대로 묶였는지 확인해.",
  // 8 — encode to latent (raw, unscaled) and inspect range
  {
    text: "이미지 배치를 VAE 인코더에 통과시켜 latent로 압축해. vae.encode(...).latent_dist.sample()은 '분포에서 한 번 뽑기'야 — VAE는 점 하나가 아니라 가우시안 분포를 내놓고, 거기서 샘플링해서 (5, 4, 64, 64)짜리 latent를 얻어. 입력 이미지값은 깔끔하게 −1~1인데, 갓 뽑은 raw latent의 min/max를 찍어보면 −57~+39처럼 범위가 제멋대로 널뛰어. 이 들쭉날쭉함이 다음 셀에서 '스케일링'이 왜 필요한지의 이유가 돼.",
    diagram: {
      title: "이미지 → latent 인코딩",
      kind: "algorithm",
      summary: `flowchart TD
  A["이미지 배치 (5,3,512,512)<br/>값 −1~1"] --> B["vae.encode(...)"]
  B --> C["latent_dist (가우시안 분포)"]
  C --> D[".sample() → (5,4,64,64)"]
  D --> E["raw latent 범위 −57~+39<br/>스케일이 제멋대로"]`,
    },
  },
  // 9 — latent[0].shape
  "latent 한 장의 모양을 콕 찍어봐 — (4, 64, 64). 512×512×3 = 약 78만 개 숫자가 4×64×64 = 16,384개로 줄었어. 거의 48배 압축. 확산을 이 작은 텐서 위에서 돌리면 메모리·연산이 확 줄어든다는 게 LDM의 핵심이야.",
  // 10 — scale latent by scaling_factor and visualize
  {
    text: "raw latent에 vae.config.scaling_factor(SD1.5는 약 0.18215)를 곱해 크기를 길들여. 이 상수는 학습 데이터로 잰 latent의 표준편차라서, 곱하고 나면 latent가 대략 '분산 1' 근처로 정돈돼 — 그래야 확산 노이즈 스케줄이랑 박자가 맞거든. 곱한 뒤 min/max를 다시 찍으면 −10~+7 정도로 얌전해진 게 보여. latent 4채널을 평균 내 흑백으로 띄워보면 얼굴의 흐릿한 윤곽이 비쳐 — 압축됐어도 의미는 살아있다는 증거야. (확산 학습/샘플링은 항상 이 '스케일된 latent' 위에서 도는 게 표준 규약.)",
    diagram: {
      title: "latent 스케일링 (분산 ≈ 1)",
      kind: "algorithm",
      summary: `flowchart TD
  A["raw latent 범위 −57~+39"] --> B["× scaling_factor (≈0.18215)"]
  B --> C["스케일 latent 범위 −10~+7<br/>분산 ≈ 1"]
  C --> D["채널 평균 → 흑백 시각화"]
  D --> E["흐릿한 얼굴 윤곽 비침<br/>의미 보존 확인"]`,
    },
  },
  // 11 — decode latent back, compare reconstruction
  {
    text: "압축이 정말 멀쩡한지 거꾸로 풀어봐. 스케일된 latent를 다시 scaling_factor로 나눠 원래 크기로 되돌린 뒤 vae.decode로 픽셀 이미지로 복원해. 원본과 복원본을 나란히 띄워 비교하면 거의 똑같아 — 48배나 압축했는데도 얼굴이 그대로 살아있지. 이게 LDM이 성립하는 토대야: VAE가 '압축↔복원'을 충실히 해주니까, 우리는 안심하고 작은 latent 위에서만 확산을 돌리고 마지막에 한 번만 decode하면 돼.",
    diagram: {
      title: "latent → 이미지 복원 (왕복 검증)",
      kind: "algorithm",
      summary: `flowchart TD
  A["스케일 latent"] --> B["÷ scaling_factor"]
  B --> C["vae.decode(...).sample"]
  C --> D["복원 이미지 512×512"]
  D --> E["원본과 나란히 비교<br/>거의 동일 → 압축 손실 미미"]`,
    },
  },
  // 12 — rebuild UNet with 4 channels (latent-space) and print
  {
    text: "이제 확산 모델을 'latent 전용'으로 다시 지어. 아까 픽셀용은 3채널이었지만, latent는 4채널이니 in_channels=out_channels=4로 바꿔. 나머지 구조(64 샘플 크기, 다운/업블록, 어텐션, 클래스 임베딩)는 그대로. 이 U-Net은 RGB 픽셀이 아니라 'VAE가 뱉은 4채널 latent'를 보고 거기 낀 노이즈를 예측하게 돼. 만들고 구조를 출력해 conv_in/conv_out이 4채널로 바뀐 걸 확인해.",
    diagram: {
      title: "latent 전용 U-Net (4채널)",
      kind: "architecture",
      summary: `flowchart TD
  IN["입력 latent 4채널 (64×64)"] --> CONV["conv_in → 64채널"]
  CONV --> BODY["다운/업블록 + 어텐션<br/>(픽셀용과 동일 구조)"]
  BODY --> OUT["conv_out → 4채널 (예측 노이즈)"]
  NOTE["픽셀용은 3채널 → latent용은 4채널"] -.-> IN`,
    },
  },
  // 13 — memory test for the latent-space UNet
  {
    text: "마지막으로 latent용 U-Net의 메모리를 재서 본전을 확인해. (1, 4, 64, 64)짜리 더미 latent 한 개를 넣어 1회 추론하고 peak 메모리를 찍어봐 — 100MB 안쪽이야. 앞에서 픽셀 U-Net이 512 해상도에 1GB를 넘겼던 걸 떠올리면, 같은 '512×512 이미지'를 다루는데도 latent에서 돌리니 메모리가 10배 넘게 줄었어. 이게 LDM(=Stable Diffusion 계열)이 일반 GPU에서도 고해상도 생성을 돌릴 수 있게 만든 결정적 트릭이야: 무거운 확산은 작은 latent에서, 픽셀 복원은 VAE가 마지막에 딱 한 번.",
    diagram: {
      title: "latent U-Net 메모리 (본전 확인)",
      kind: "algorithm",
      summary: `flowchart TD
  A["더미 latent (1,4,64,64)"] --> B["U-Net 1회 추론"]
  B --> C["peak 메모리 측정 → 100MB 미만"]
  C --> D["픽셀 512 = 1GB+ 대비 10배↓"]
  D --> E["일반 GPU에서 고해상도 생성 가능"]`,
    },
  },
];

export default explanations;
