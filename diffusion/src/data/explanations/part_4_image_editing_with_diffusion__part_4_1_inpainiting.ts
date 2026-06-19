// Part 4.1 인페인팅(inpainting) 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + load pretrained UNet (google/ddpm-celebahq-256)
  {
    text: "이번엔 처음부터 학습하지 않아. 남이 얼굴(CelebA-HQ)로 미리 훈련해둔 256×256 디퓨전 모델을 통째로 빌려와서 그 위에 '편집' 기술만 얹을 거야. 그래서 연장통도 모델 불러오기·스케줄러·진행바 정도만 꺼내. 모델 이름표(model_id)를 적고 from_pretrained로 가중치를 내려받아.",
    imports: [
      {
        name: "UNet2DModel",
        what: "diffusers의 이미지용 노이즈 예측 U-Net",
        use: "from_pretrained로 사전학습 얼굴 모델을 받아 — 매 단계 '낀 노이즈'를 예측하는 핵심 엔진",
      },
      {
        name: "DDIMScheduler",
        what: "적은 스텝으로 빠르게 디노이즈하는 결정론적 스케줄러",
        use: "50스텝짜리 역확산 루프를 돌리고, add_noise로 원본에 t만큼 노이즈를 입히는 데도 써",
      },
      {
        name: "DDPMScheduler",
        what: "원조 확률적 디노이즈 스케줄러",
        use: "여기선 import만 하고 실제론 DDIM을 써 — 비교용으로 같이 꺼내둔 것",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 그래프·이미지 표시 도구",
        use: "디노이즈 결과 텐서를 imshow로 그림으로 띄워",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "반복문 진행률 표시줄",
        use: "50스텝 디노이즈 루프가 어디까지 갔는지 막대로 보여줘",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서 연산과 GPU 가속",
        use: "노이즈 텐서 생성(randn), 장치(cuda/cpu) 지정, no_grad 추론까지 전부",
      },
    ],
  },
  // 1 — simple denoising sanity check (DDIM 50 steps from pure noise)
  {
    text: "본론 들어가기 전에 빌려온 모델이 멀쩡한지 한 번 돌려봐. 순수 랜덤 노이즈(1×3×256×256)에서 시작해서 DDIM으로 50스텝 거꾸로 내려와. 매 스텝 모델한테 '낀 노이즈 예측해' 시키고, 그 예측으로 scheduler.step이 한 칸 깨끗한 쪽으로 옮겨줘. 다 끝나면 얼굴 하나가 떠야 정상 — 이게 되면 모델은 정상이란 뜻이야. (텐서값은 −1~1 범위라 ×0.5+0.5로 0~1 화면 범위로 되돌려 그려.)",
    diagram: {
      title: "DDIM 디노이즈 (성능 확인용)",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 x_T"] --> B["50스텝 반복"]
  B --> C["U-Net이 노이즈 예측"]
  C --> D["scheduler.step → 한 칸 디노이즈"]
  D --> E{"남은 스텝?"}
  E -->|예| B
  E -->|아니오| F["얼굴 이미지 완성"]`,
    },
  },
  // 2 — load reference image + transform
  "이제 편집할 진짜 사진을 불러와. 이미지를 열어서 얼굴 부분만 잘라내고(crop) 256×256으로 줄여. 그다음 transform으로 텐서화하고 −1~1 범위로 정규화해 — 모델이 학습 때 보던 숫자 범위랑 똑같이 맞춰주는 거야. 배치 차원 하나 붙이고(unsqueeze) 장치에 올린 뒤, 잘 들어왔는지 화면에 띄워서 확인해.",
  // 3 — build a soft mask + inverse mask
  {
    text: "인페인팅의 핵심 도구, '마스크'를 만들어. 256×256 흰 판(전부 1)을 깔고 위쪽 100줄만 0으로 칠해 — 여기가 '새로 그려낼 영역'이야. 딱 자르면 경계가 칼처럼 티 나니까 gaussian_filter로 가장자리를 부드럽게 번지게 해(sigma=5). 그리고 1에서 빼서 반대 마스크(inv_mask)도 만들어. 둘은 한 쌍이야: mask는 '원본 유지할 곳', inv_mask는 '생성으로 채울 곳'. 원본 위에 두 마스크를 반투명으로 겹쳐 그려서 어디가 어디인지 눈으로 확인해.",
    diagram: {
      title: "소프트 마스크 한 쌍",
      kind: "architecture",
      summary: `flowchart TD
  M["흰 판 (전부 1.0)"] --> Z["위쪽 100줄 = 0.0<br/>여기를 새로 그림"]
  Z --> G["gaussian_filter σ=5<br/>경계 부드럽게 번짐"]
  G --> MASK["mask: 원본 유지(1) / 생성(0)"]
  MASK --> INV["inv_mask = 1 − mask<br/>역할 반대"]`,
    },
  },
  // 4 — RePaint-style inpainting loop (blend each step)
  {
    text: "드디어 다시 칠하기(repaint). 핵심 아이디어 한 줄이야 — '매 스텝, 마스크 안쪽은 원본을 그대로 끼워넣고, 바깥쪽만 모델이 상상해서 채우게 한다.' 그래서 루프 안에서 두 가지가 동시에 돌아: ① 모델은 노이즈 xt를 한 칸 디노이즈하고(생성), ② 동시에 원본 사진에도 지금 시각 t에 딱 맞는 양만큼 노이즈를 입혀(add_noise) x_noised를 만들어. 그리고 둘을 마스크로 섞어: 유지할 영역(mask)엔 노이즈 입힌 원본을, 새로 그릴 영역(inv_mask)엔 모델이 만든 걸 넣어. 단계마다 같은 노이즈 레벨에서 합치니까 이음매 없이 자연스럽게 메워져. 이게 RePaint 논문(arXiv 2201.09865)이 쓰는 방식이고, 요즘 Diffusers 인페인트 파이프라인도 같은 'blended diffusion' 골격을 따라. seed를 0~9로 바꿔가며 10장 뽑아 — 같은 자리를 매번 다르게 채우는 다양성을 보는 거야.",
    diagram: {
      title: "RePaint 인페인팅 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["순수 노이즈 x_t"] --> B["50스텝 반복"]
  B --> C["원본에 시각 t 노이즈 입힘<br/>x_noised = add_noise(원본, t)"]
  B --> D["U-Net이 x_t 한 칸 디노이즈"]
  C --> E["마스크로 합성"]
  D --> E
  E --> F["유지영역=원본 · 생성영역=모델"]
  F --> B
  B --> G["완성 (seed별 10장)"]`,
      detail: `flowchart TD
  S["seed 0…9 각각"] --> X0["x_t ~ N(0, I)"]
  X0 --> LOOP["for t in timesteps (50)"]
  LOOP --> NZ["noise ~ N(0, I)"]
  NZ --> XN["x_noised = scheduler.add_noise(ref, noise, t)"]
  LOOP --> PRED["noise_pred = unet(x_t, t).sample"]
  PRED --> STEP["x_t = scheduler.step(noise_pred, t, x_t).prev_sample"]
  STEP --> BLEND["x_t = x_t·inv_mask + x_noised·mask"]
  XN --> BLEND
  BLEND --> LOOP
  LOOP --> SHOW["imshow(x_t)"]`,
    },
  },
];

export default explanations;
