// Part 10-2 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통 펼치기. 이번 주제는 'VRAM을 어떻게 아끼느냐' — 모델 가중치를 더 적은 비트로 욱여넣는 양자화(quantization)야. 먼저 평범한 SD 파이프라인을 불러 메모리를 재보고, 그다음 4비트로 짓눌러 얼마나 줄어드는지 비교할 거야.",
    imports: [
      {
        name: "diffusers · StableDiffusionPipeline · DDIMScheduler",
        what: "사전학습 SD 파이프라인 + 빠른 샘플러",
        use: "fp16 기준 파이프라인을 불러 메모리·생성 품질을 잰 뒤, 4비트 U-Net으로 바꿔 같은 걸 비교",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서·CUDA 메모리 계측·시드",
        use: "torch.cuda.memory_allocated로 VRAM을 직접 재고, float16/4bit 데이터타입을 지정해",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "생성 이미지 표시",
        use: "fp16과 4비트가 같은 'Fantasy dragon'을 얼마나 비슷하게 그리는지 눈으로 비교",
      },
      {
        name: "numpy (np) · PIL · transforms · tqdm · clear_output · Path · load_image",
        what: "배열·이미지·전처리·진행바·경로 유틸",
        use: "여기선 거의 안 써 — 시리즈 공통 import 줄을 맞춰둔 정도",
      },
    ],
  },
  // 1 — print_gpu_memory helper
  "VRAM 사용량을 찍어주는 헬퍼를 정의해. 지금 할당된 메모리·예약된 메모리·최고점(peak) 세 가지를 MB로 보여줘. 양자화의 효과는 결국 '숫자로 줄었나'로 증명해야 하니, 이걸 전후로 호출해 비교할 거야.",
  // 2 — load fp16 baseline pipeline
  "기준선으로 보통 SD1.5를 fp16으로 불러와 DDIM 스케줄러를 깔아. fp16(16비트 부동소수)은 이미 fp32 대비 절반으로 줄인 상태지만, 여기서 더 짜낼 수 있는지 보는 게 이번 목표야.",
  // 3 — fp16 UNet footprint
  "U-Net이 차지하는 메모리를 GB 단위로 재봐. U-Net은 SD에서 제일 무거운 부품(노이즈 예측 본체)이라, 양자화로 노릴 1순위 타깃이야. 이 숫자를 적어두고 4비트 버전과 맞대볼 거야.",
  // 4 — fp16 generation + peak memory
  "fp16 파이프라인으로 'Fantasy dragon'을 35스텝 생성하면서 peak 메모리를 재. 품질 기준선이자 메모리 기준선 — 다음에 4비트로 같은 그림을 뽑아 '메모리는 얼마나 줄고 품질은 얼마나 유지되나'를 판단할 잣대야.",
  // 5 — free the fp16 pipeline
  "4비트 실험을 깨끗한 상태에서 하려고 fp16 파이프라인을 GPU에서 내리고(.to('cpu')), 캐시를 비우고(empty_cache), 객체를 삭제(del)해 VRAM을 완전히 회수해. 이걸 안 하면 두 모델이 메모리에 겹쳐 올라가 측정이 오염되거든.",
  // 6 — quantization imports
  {
    text: "4비트 양자화 도구를 불러와. diffusers의 BitsAndBytesConfig(별칭 DiffusersBitsAndBytesConfig)와 따로 불러올 U-Net 클래스야. bitsandbytes는 가중치를 4비트로 압축해주는 라이브러리고, diffusers가 이걸 모델 로드에 바로 끼울 수 있게 감싸놨어.",
    imports: [
      {
        name: "diffusers · BitsAndBytesConfig (→ DiffusersBitsAndBytesConfig)",
        what: "bitsandbytes 양자화 설정을 담는 객체",
        use: "load_in_4bit·nf4·double_quant 같은 옵션을 적어 from_pretrained에 넘기면 U-Net이 4비트로 로드돼",
      },
      {
        name: "diffusers · UNet2DConditionModel",
        what: "SD의 U-Net을 따로 불러오는 클래스",
        use: "통짜 파이프라인 대신 U-Net만 4비트로 로드한 뒤, 그걸 파이프라인에 꽂아 넣어",
      },
    ],
  },
  // 7 — 4-bit quant config + load UNet into pipeline
  {
    text: "핵심 셀 — U-Net을 4비트로 불러와 파이프라인에 끼워. 설정을 보면: load_in_4bit(4비트로 압축), nf4(정규분포 가중치에 최적화된 4비트 포맷 'Normal Float 4'), double_quant(양자화 상수까지 한 번 더 압축해 추가 절약), compute_dtype=fp16(실제 계산은 fp16으로 풀어서). 이렇게 U-Net만 4비트로 로드해 나머지(VAE·텍스트 인코더)와 합쳐 파이프라인을 조립해 — 텍스트 인코더·VAE는 작고 선형층이 적어 보통 양자화 안 해. 같은 기법으로 12GB 한 장짜리 GPU나 무료 Colab에서도 FLUX 같은 거대 모델을 굴릴 수 있게 되는 게 이 절의 핵심 응용이야.",
    diagram: {
      title: "4비트 양자화 로드",
      kind: "algorithm",
      summary: `flowchart TD
  CFG["BitsAndBytesConfig<br/>load_in_4bit · nf4 · double_quant"] --> LOAD["UNet2DConditionModel.from_pretrained<br/>(quantization_config=cfg)"]
  LOAD --> Q["U-Net 가중치 → 4비트로 압축<br/>(계산 시 fp16으로 풀어 씀)"]
  Q --> PIPE["pipeline = SD(unet=4bit U-Net)<br/>VAE·텍스트 인코더는 그대로"]`,
      detail: `flowchart TD
  W["원본 U-Net 가중치 (fp16)"] --> NF4["NF4 4비트로 양자화<br/>(정규분포에 맞춘 16단계 표현)"]
  NF4 --> DQ["double_quant: 양자화 상수도 다시 압축<br/>(+0.4비트/파라미터 절약)"]
  DQ --> STORE["저장: 약 1/4 메모리"]
  STORE --> RUN["추론 때 그 레이어만 fp16으로 역양자화 → 계산"]
  SKIP["VAE · CLIP 텍스트 인코더"] --> NOQ["양자화 안 함<br/>(작고 Linear층 적음)"]
  STORE --> ASSEM["pipeline 조립"]
  NOQ --> ASSEM`,
    },
  },
  // 8 — 4-bit UNet footprint
  "4비트 U-Net의 메모리를 다시 재서 3번(fp16)과 비교해. 4비트는 16비트의 1/4이니 U-Net 메모리가 대략 4분의 1 가까이로 뚝 떨어진 게 숫자로 보일 거야. '진짜 줄었다'를 눈으로 확인하는 결정적 비교야.",
  // 9 — inspect param dtypes
  "U-Net 파라미터들의 데이터타입을 훑어 찍어봐. 양자화된 선형층 가중치는 uint8 계열(4비트를 담는 그릇)로, 양자화 안 된 부분은 fp16으로 섞여 보일 거야 — '모든 층이 아니라 무거운 선형층만 골라 압축됐다'는 양자화의 실제 모습을 확인하는 거지.",
  // 10 — 4-bit generation + peak memory
  "마지막으로 4비트 파이프라인으로 똑같이 'Fantasy dragon'을 35스텝 생성하고 peak 메모리를 재서 4번(fp16)과 맞대봐. 두 가지를 동시에 판단해: peak VRAM이 확실히 줄었는지, 그리고 4비트로 짓눌렀는데도 그림 품질이 쓸 만하게 유지되는지. 보통 약간의 화질 손해를 내주고 큰 메모리 절약을 얻는 — 저사양 GPU에서 큰 모델을 굴리기 위한 현실적 거래야.",
];

export default explanations;
