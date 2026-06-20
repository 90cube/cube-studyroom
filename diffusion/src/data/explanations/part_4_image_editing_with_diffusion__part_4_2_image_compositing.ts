// Part 4.2 이미지 합성 / image-to-image 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + load pretrained UNet, print the architecture
  {
    text: "앞 노트북과 같은 얼굴 모델(google/ddpm-celebahq-256)을 다시 빌려와. 여기선 from_pretrained 뒤에 eval()로 추론 모드 박고 장치에 올린 다음, 모델을 그냥 출력해서 구조를 펼쳐봐 — Conv → 다운블록(점점 작아지며 채널↑) → 가운데 어텐션 → 업블록(다시 커지며)으로 이어지는 전형적인 U-Net이야. 이 구조를 눈에 익혀두면 왜 256×256 한 장 처리에 메모리가 꽤 드는지 감이 와.",
    imports: [
      {
        name: "UNet2DModel",
        what: "diffusers 이미지용 노이즈 예측 U-Net",
        use: "사전학습 얼굴 모델 본체. 매 디노이즈 스텝에서 낀 노이즈를 예측",
      },
      {
        name: "DDIMScheduler",
        what: "결정론적 빠른 디노이즈 스케줄러",
        use: "from_pretrained로 불러와 add_noise(원본 더럽히기)·step(한 칸 복원) 둘 다 담당",
      },
      {
        name: "DDPMScheduler",
        what: "원조 확률적 스케줄러",
        use: "import만 — 실제 사용은 DDIM",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "이미지·서브플롯 표시 도구",
        use: "원본 vs 변형 결과를 subplot으로 나란히 비교",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "진행률 표시줄",
        use: "디노이즈 루프 진행 상황 표시",
      },
      {
        name: "torch",
        what: "PyTorch 텐서·GPU",
        use: "노이즈 생성, 장치 지정, no_grad 추론",
      },
    ],
  },
  // 1 — load reference image (dt_hair.png) + transform
  "변형할 사진을 불러와. dt_hair.png를 256×256으로 줄이고 RGB로 바꾼 뒤, transform으로 텐서화하고 −1~1로 정규화해(모델 학습 범위에 맞춤). 배치 차원 붙여 장치에 올리고, 제대로 들어왔는지 화면에 띄워 확인해. 이 한 장이 앞으로 '출발점'이 될 원본이야.",
  // 2 — add noise at a specific timestep (denoising_t = 500)
  {
    text: "image-to-image의 출발점을 만들어. 핵심은 '원본을 완전 노이즈로 갈아엎지 말고, 딱 절반(t=500)만 더럽히자'는 거야. 그래야 원본의 큰 구도·윤곽은 노이즈 속에 살아남고, 디테일만 다시 그릴 여지가 생겨. scheduler.add_noise로 원본에 t=500 수준의 노이즈를 한 방에 입혀서 x_noised를 만들고 띄워봐 — 흐릿하지만 누군지 형체는 남아있는 게 보일 거야. 더 많이 더럽힐수록(t↑) 원본에서 멀어지고, 적게 더럽힐수록(t↓) 원본에 가까워져. 이 '얼마나 더럽힐지'가 곧 변형 강도(denoising strength)야. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      4: "denoising_t=500 = 변형 강도 다이얼. 1000단계 중 절반만 더럽힌다는 뜻 — 이 숫자 하나가 '원본 보존 ↔ 창의적 변형'을 결정해.",
      6: "manual_seed(0)으로 노이즈를 고정 — 강도 비교할 때 노이즈가 매번 바뀌면 공정한 비교가 안 되니까.",
      10: "add_noise로 원본을 딱 t=500 수준만 더럽혀. 완전 노이즈가 아니라 '반쯤 흐린' 상태 — 구도는 남고 디테일만 날아가. 이게 img2img의 출발 이미지.",
    },
    diagram: {
      title: "부분 노이즈 = 변형 강도 조절",
      kind: "algorithm",
      summary: `flowchart TD
  A["원본 ref_image"] --> B["t = 500 선택<br/>(절반만 더럽힘)"]
  B --> C["noise ~ N(0, I)"]
  C --> D["x_noised = add_noise(ref, noise, t)"]
  D --> E["구도는 유지 · 디테일만 흐림"]`,
    },
  },
  // 3 — inspect scheduler.timesteps
  "스케줄러가 어떤 시각들을 거쳐 내려올 건지 timesteps 목록을 찍어봐. 980, 960, … 20, 0처럼 큰 값에서 0까지 50칸으로 내려가. 다음 셀에서 't가 500보다 크면 건너뛴다'를 쓸 건데, 이 목록을 보면 왜 500부터 시작되는지(500 이하 칸만 실제로 도는지)가 한눈에 들어와.",
  // 4 — img2img denoising loop starting from x_noised
  {
    text: "이제 흐릿해진 x_noised에서 디노이즈를 시작해. 단, 전체 50스텝을 다 돌리는 게 아니라 't > 500'인 앞쪽 스텝은 continue로 건너뛰어 — 우리는 t=500 지점에서 출발했으니 그보다 더 더럽히는 단계는 의미가 없거든. 500부터 0까지만 모델이 한 칸씩 깨끗하게 만들어가. 결과를 원본과 나란히 띄워 비교해봐: 큰 틀은 같은데 질감·디테일이 모델식으로 새로 그려진 게 보일 거야. 이게 바로 SDEdit이 제안한 image-to-image의 뼈대고, 실무에선 제품 사진을 배경만 바꿔 재촬영하거나(product recontextualization) 스케치를 사실적 이미지로 끌어올리는 데 그대로 쓰여 — 강도만 돌리면 '원본 보존 ↔ 창의적 변형' 사이를 자유롭게 오갈 수 있어. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      3: "출발점을 순수 노이즈가 아니라 아까 만든 x_noised(반쯤 흐린 원본)로 잡는 게 img2img의 핵심.",
      6: "scheduler.timesteps는 980→0 전 구간을 돌지만,",
      8: "t가 500보다 크면(=더 더럽히는 앞 구간)",
      9: "continue로 건너뛰어 — 우린 t=500에서 출발했으니 그보다 위 단계는 의미 없어. 500부터 0까지만 실제로 도는 거야.",
      14: "남은 500→0 구간만 모델이 한 칸씩 디노이즈 — 흐린 원본을 모델식 디테일로 새로 그려 채워.",
    },
    diagram: {
      title: "image-to-image 디노이즈 (부분 시작)",
      kind: "algorithm",
      summary: `flowchart TD
  A["x_noised (t=500에서 시작)"] --> B["timesteps 순회"]
  B --> C{"t > 500 ?"}
  C -->|예| B
  C -->|아니오| D["U-Net 노이즈 예측"]
  D --> E["scheduler.step → 한 칸 디노이즈"]
  E --> B
  B --> F["변형 결과 (원본과 비교)"]`,
    },
  },
  // 5 — grid: sweep denoising strength across 10 timesteps
  {
    text: "변형 강도를 0부터 990까지 10단계로 쪼개서, 같은 사진을 강도별로 한 줄에 쭉 뽑아 비교해. 각 칸마다: 그 강도(denoising_t)만큼만 원본을 더럽히고 → 거기서부터 디노이즈 → 결과를 격자에 꽂아. 왼쪽(약한 강도)은 원본과 거의 똑같고, 오른쪽으로 갈수록 점점 모델이 자기 마음대로 새 얼굴을 그려내 — 결국 원본과 무관해져. 이 한 장의 스트립이 '강도 다이얼을 어디에 두면 무슨 일이 일어나는지' 직관을 통째로 보여줘. 실제 작업에선 이 스윕을 먼저 보고 원하는 보존/변형 균형점을 고르는 게 정석이야. (보라색 줄에 마우스 올리면 줄별 풀이가 떠.)",
    lines: {
      6: "강도 후보 10개를 0~990 등간격으로 — 이걸 하나씩 돌려 강도별 결과를 한 줄에 늘어놓을 거야.",
      9: "매 칸마다 seed를 똑같이 0으로 리셋 — 강도 차이만 보이게, 노이즈는 동일 조건으로 고정.",
      13: "그 칸의 강도 denoising_t만큼만 원본을 더럽혀 출발점 마련.",
      20: "앞 셀과 같은 트릭 — 현재 강도보다 위 단계(t > denoising_t)는",
      21: "continue로 건너뛰어. 강도가 클수록 더 일찍부터 디노이즈해서 더 많이 변형돼.",
    },
    diagram: {
      title: "강도 스윕 (0 → 990, 10단계)",
      kind: "algorithm",
      summary: `flowchart TD
  A["timesteps = linspace(0, 990, 10)"] --> B["각 강도 t_k 마다"]
  B --> C["원본을 t_k 만큼 더럽힘"]
  C --> D["t_k 이하 구간만 디노이즈"]
  D --> E["격자 칸 axes[k]에 그림"]
  E --> B
  B --> F["약함=원본보존 … 강함=완전생성"]`,
    },
  },
];

export default explanations;
