// Part 9-1 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + device
  {
    text: "연장통부터 펼쳐. 이번엔 직접 모델을 짜는 게 아니라 '이미 다 만들어진 Stable Diffusion 파이프라인'을 불러다 쓸 거야 — 그래서 diffusers가 주인공이야. 마지막 줄에서 GPU 있으면 GPU, 없으면 CPU를 쓰라고 정해놔.",
    imports: [
      {
        name: "diffusers · StableDiffusionPipeline · DDIMScheduler",
        what: "사전학습된 SD 모델을 통째로 굴리는 파이프라인 + 빠른 샘플러",
        use: "핵심 도구. from_pretrained로 SD1.5를 통째로 불러오고, 스케줄러를 DDIM으로 갈아끼워. 여기에 LoRA·텍스추얼 인버전을 얹어",
      },
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU 연산",
        use: "float16(half precision)으로 모델 올리고, manual_seed로 생성 결과를 매번 똑같이 재현",
      },
      {
        name: "matplotlib.pyplot (plt)",
        what: "기본 그래프·이미지 표시 도구",
        use: "생성된 platypus 이미지들을 격자로 나란히 깔아서 보여줘",
      },
      {
        name: "diffusers.utils.load_image",
        what: "URL·경로에서 이미지를 바로 PIL로 읽는 헬퍼",
        use: "이 노트북에선 거의 안 써 — 다른 실험과 import를 맞춰둔 정도",
      },
      {
        name: "PIL.Image",
        what: "파이썬 기본 이미지 객체",
        use: "load_image가 돌려주는 이미지 타입 — 직접 호출은 드물어",
      },
      {
        name: "numpy (np) · torchvision.transforms · tqdm · clear_output · Path",
        what: "배열·이미지 변환·진행바·출력 지우기·경로 도구 묶음",
        use: "여기선 거의 장식 — 시리즈 다른 노트북과 import 줄을 공통으로 맞춰둔 거야",
      },
    ],
  },
  // 1 — pipeline + DDIM scheduler
  {
    text: "SD1.5 파이프라인을 통째로 불러와. safety_checker=None으로 안전필터는 꺼서(연구·실험용) 속도 챙기고, torch.float16으로 올려서 VRAM을 반으로 줄여. 그다음 기본 스케줄러를 DDIM으로 바꿔 — 적은 스텝으로 깔끔하게 디노이즈하는 빠른 샘플러야.",
    diagram: {
      title: "SD 파이프라인 구성",
      kind: "architecture",
      summary: `flowchart TD
  P["StableDiffusionPipeline<br/>from_pretrained (fp16)"] --> TE["Text Encoder<br/>(CLIP)"]
  P --> U["U-Net<br/>(노이즈 예측)"]
  P --> V["VAE<br/>(latent ↔ 이미지)"]
  P --> S["Scheduler<br/>→ DDIM 으로 교체"]`,
    },
  },
  // 2 — baseline generation (scale 0.0)
  {
    text: "LoRA를 얹기 전, 맨몸 SD1.5가 'platypus(오리너구리)'를 어떻게 그리는지 먼저 봐. 시드 5개로 5장 뽑아서 한 줄에 깔아. 여기서 cross_attention_kwargs의 scale=0.0은 'LoRA 효과 0%' — 즉 아직 LoRA가 없으니 순수 베이스 모델 결과야. 나중과 비교할 기준선을 만드는 거지.",
    lines: {
      6: "guidance_scale=8 — 텍스트 CFG 세기. 프롬프트를 얼마나 강하게 따를지(LoRA scale과 별개).",
      10: "cross_attention_kwargs={\"scale\": 0.0} — LoRA 세기 다이얼. 0.0이라 LoRA 영향 0%, 순수 베이스.",
      11: "generator=torch.manual_seed(seed) — 시드 고정으로 재현. 시드만 바꿔 5가지 변형.",
    },
  },
  // 3 — load_lora_weights
  {
    text: "이제 LoRA 가중치를 얹어. 허브에서 'platypus 전용으로 미세조정된 작은 어댑터'를 받아 파이프라인에 끼워넣는 한 줄이야. LoRA는 거대한 원본 가중치는 그대로 두고, U-Net의 어텐션 층에 작은 보정 행렬(A×B)만 더해 붙이는 방식 — 그래서 파일이 수~수십 MB로 가볍고 갈아끼우기 쉬워. (text_encoder LoRA가 없다는 경고는 정상 — 이 어댑터는 U-Net만 건드려.)",
    lines: {
      2: "\"Mohan-diffuser/lora_platypus_sd_15\" — 허깅페이스 LoRA 저장소 ID. 이 한 인자만으로 어댑터를 받아 파이프라인 어텐션 층에 끼워.",
    },
    diagram: {
      title: "LoRA 주입 메커니즘",
      kind: "architecture",
      summary: `flowchart TD
  IN["입력 x"] --> W["원본 가중치 W<br/>(고정·freeze)"]
  IN --> A["LoRA A (r차원으로 압축)"]
  A --> B["LoRA B (다시 펼침)"]
  W --> SUM(("+"))
  B --> SC["× scale"]
  SC --> SUM
  SUM --> OUT["출력 = Wx + scale·(BA)x"]`,
      detail: `flowchart TD
  subgraph U["U-Net 크로스/셀프 어텐션"]
    Q["to_q"] --- K["to_k"] --- V["to_v"] --- O["to_out"]
  end
  L["load_lora_weights(repo)"] --> INJ["각 to_q/k/v/out 옆에<br/>A·B 두 행렬을 끼움"]
  INJ --> U
  CFG["cross_attention_kwargs<br/>scale = LoRA 세기"] --> O
  note["원본 가중치는 0% 변경<br/>학습된 건 A·B 뿐 (랭크 r)"]:::n
  classDef n fill:#fff7ed,stroke:#f59e0b`,
    },
  },
  // 4 — single generation with scale 0.8
  "LoRA를 끼운 채로 한 장 뽑아봐. 이번엔 scale=0.8 — 'LoRA 효과 80%'로 적용하라는 뜻이야. 같은 'platypus' 프롬프트인데 3번 셀에서 받은 어댑터가 학습한 그 특유의 오리너구리 모양·화풍이 묻어나는지 베이스라인과 비교해.",
  // 5 — lora_scale sweep
  {
    text: "LoRA를 '얼마나 세게' 적용할지 손잡이를 0.0부터 1.4까지 쭉 돌려가며 한 장씩 뽑아 나란히 깔아. scale=0이면 베이스 모델 그대로, 1.0이면 학습한 그대로, 1.4면 과하게 밀어붙인 거야. 이 한 줄짜리 스윕으로 'LoRA는 켜고 끄는 스위치가 아니라 세기 조절 다이얼'이라는 걸 눈으로 확인해 — 보통 0.6~1.0 사이가 제일 자연스러워. (실무에선 set_adapters로 화풍 LoRA와 캐릭터 LoRA를 각자 다른 scale로 섞어 새 조합을 만들기도 해.)",
    lines: {
      2: "lora_scales — 0.0부터 1.4까지 시험할 세기 목록. 0=베이스, 1.0=학습 그대로, >1=과적용.",
      10: "cross_attention_kwargs={\"scale\": lora_scale} — 매 장 이 한 줄로 LoRA 세기만 바꿔. 비교의 핵심 변수.",
      11: "generator=torch.manual_seed(42) — 시드를 42로 고정. 노이즈를 똑같이 깔아야 scale 효과만 순수 비교돼.",
    },
  },
  // 6 — load_textual_inversion (negative embeddings)
  {
    text: "이번엔 LoRA 말고 '네거티브 임베딩' 3종을 얹어. 이것들은 LoRA처럼 가중치를 고치는 게 아니라, '망친 그림(찌그러진 손·이상한 해부학·저화질)'만 학습해 만든 작은 텍스트 토큰이야. 한 번 로드해두면 negative_prompt에 그 이름(verybadimagenegative_v1.3 · EasyNegativeV2 · ng_deepnegative_v1_75t)을 적는 것만으로 '이런 건 만들지 마'를 한 단어로 지시할 수 있어 — 긴 부정 프롬프트를 토큰 하나로 압축한 셈이지.",
    lines: {
      1: "load_textual_inversion — 가중치는 안 건드리고 새 토큰 하나를 CLIP 임베딩에 등록. 파일 형식은 .pt/.safetensors 둘 다 OK.",
      3: "이렇게 여러 개를 연달아 로드하면 각각의 토큰 이름을 프롬프트에서 골라 쓸 수 있어.",
    },
    diagram: {
      title: "Textual Inversion (네거티브 임베딩)",
      kind: "architecture",
      summary: `flowchart TD
  PT["verybadimagenegative · EasyNegativeV2<br/>ng_deepnegative (.pt/.safetensors)"] --> LTI["load_textual_inversion"]
  LTI --> EMB["새 토큰 → CLIP 임베딩에 등록<br/>(U-Net·VAE는 안 건드림)"]
  EMB --> NP["negative_prompt 에 토큰 이름만 적으면<br/>'망친 그림' 방향을 통째로 밀어냄"]`,
    },
  },
  // 7 — negative-embedding generation sweep
  "프롬프트를 'platypus, eating icecream'으로 바꾸고 다시 LoRA scale을 0.0~1.4로 스윕해. (negative_prompt 줄은 주석 처리돼 있어 — 6번에서 네거티브 임베딩을 '장전'만 해두고, 이 셀에선 LoRA 세기 변화에 집중해서 보는 거야. 주석만 풀면 그 네거티브 토큰들이 바로 작동해 화질을 끌어올려줘.)",
];

export default explanations;
