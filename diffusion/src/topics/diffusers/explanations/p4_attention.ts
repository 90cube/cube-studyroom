import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — usage: inspect + set_attn_processor
  {
    text: "diffusers에서 어텐션 레이어는 'Q·K·V를 어떻게 계산할지'를 직접 안 들고 있어 — 전부 processor 객체한테 위임해. attn_processors를 찍어보면 U-Net 안의 모든 어텐션 자리(이름→프로세서)가 보여. PyTorch 2.0이면 기본이 AttnProcessor2_0(빠른 SDPA 커널)이야. set_attn_processor 한 줄로 전부 갈아끼울 수 있는데, 이 후크가 핵심이야 — IP-Adapter, LoRA, 어텐션 슬라이싱 같은 확장이 죄다 '이 자리에 다른 프로세서를 꽂는' 방식으로 동작하거든.",
    imports: [
      {
        name: "StableDiffusionPipeline",
        what: "SD 파이프라인 — 내부에 unet을 들고 있음",
        use: "pipe.unet.attn_processors 조회 / set_attn_processor 호출의 진입점",
      },
      {
        name: "AttnProcessor2_0",
        what: "PyTorch 2.0 SDPA 기반 기본 어텐션 프로세서",
        use: "set_attn_processor(AttnProcessor2_0())로 U-Net 전체에 명시적으로 꽂아",
      },
      {
        name: "torch",
        what: "PyTorch — GPU·반정밀도",
        use: "float16 로 파이프라인 적재, .to('cuda')",
      },
    ],
  },
  // 1 — self vs cross core (algorithm)
  {
    text: "어텐션의 정체를 6줄로 보는 거야. Query는 '무조건' 이미지 latent(hidden_states)에서 뽑아 — 즉 '이미지 쪽이 질문하는' 구조야. 진짜 갈림길은 K·V를 어디서 뽑느냐: encoder_hidden_states가 없으면 자기 자신(hidden_states)을 그대로 써 → self-attention, 픽셀끼리 서로를 참조해 전역 일관성을 잡아. 텍스트 임베딩이 들어오면 거기서 K·V를 뽑아 → cross-attention, 이미지의 각 위치가 '어떤 단어를 봐야 하나'를 묻는 거지. 그 뒤는 멀티헤드로 쪼개고 softmax(Q·Kᵀ/√d)·V를 SDPA 커널로 한 방에 계산해 출력 투영으로 마무리. 같은 코드가 텍스트 유무만으로 self↔cross를 오간다는 게 핵심이야.",
    diagram: {
      title: "self vs cross — K·V 출처가 가른다",
      kind: "algorithm",
      summary: `flowchart TD
  H["hidden_states (이미지 latent)"] --> Q["Q = to_q(hidden_states) (항상)"]
  H --> DEC{"encoder_hidden_states 있나 ?"}
  DEC -->|아니오| SELF["K,V ← hidden_states<br/>self-attention (픽셀끼리)"]
  DEC -->|예 (텍스트)| CROSS["K,V ← encoder_hidden_states<br/>cross-attention (텍스트 참조)"]
  SELF --> SDPA["softmax(Q·Kᵀ/√d)·V"]
  CROSS --> SDPA
  Q --> SDPA
  SDPA --> O["to_out 투영"]`,
      detail: `flowchart TD
  H["hidden_states"] --> Q0["query = to_q(hidden_states)"]
  H --> C{"encoder_hidden_states is None ?"}
  C -->|None| S["ehs = hidden_states (self)"]
  C -->|텍스트| X["ehs = encoder_hidden_states<br/>(norm_cross면 정규화)"]
  S --> K["key = to_k(ehs)"]
  X --> K
  S --> V["value = to_v(ehs)"]
  X --> V
  Q0 --> MH["view → (B, heads, seq, head_dim)<br/>멀티헤드 분할"]
  K --> MH2["멀티헤드 분할"]
  V --> MH3["멀티헤드 분할"]
  MH --> SDPA["scaled_dot_product_attention<br/>(+ attention_mask)"]
  MH2 --> SDPA
  MH3 --> SDPA
  SDPA --> R["reshape → 헤드 합치기"]
  R --> OUT["to_out[0] 선형 투영"]`,
    },
  },
  // 2 — IP-Adapter swap (architecture, depth)
  {
    text: "이제 '프로세서 교체 = 확장'이 진짜 뭔지 봐. IPAdapterAttnProcessor2_0는 방금 본 기본 프로세서를 거의 그대로 복제하되, 이미지 프롬프트 전용 K·V 투영(to_k_ip, to_v_ip)을 두 개 더 달아. 동작은 2단이야: (1) 텍스트로 평소처럼 cross-attention을 돌려 결과를 얻고, (2) '똑같은 Query'로 이번엔 이미지 임베딩에 대해 한 번 더 어텐션을 돌려. 그리고 둘을 hidden = 텍스트결과 + scale·이미지결과로 합쳐. 본체 to_q/to_k/to_v 가중치는 1도 안 건드리고 작은 Linear 두 개만 추가한 거라, 학습도 싸고 끼웠다 뺐다도 자유로워. 어텐션을 프로세서로 추상화해 둔 설계의 보상이지.",
    diagram: {
      title: "IP-Adapter — 텍스트 + 이미지 이중 어텐션",
      kind: "architecture",
      summary: `flowchart TD
  Q["Query (이미지 latent)"] --> T["① 텍스트 cross-attn<br/>to_k / to_v"]
  Q --> I["② 이미지 cross-attn<br/>to_k_ip / to_v_ip"]
  TXT["텍스트 임베딩"] --> T
  IMG["이미지 임베딩"] --> I
  T --> SUM["hidden = 텍스트결과 + scale · 이미지결과"]
  I --> SUM
  SUM --> OUT["출력"]`,
      detail: `flowchart TD
  EHS["encoder_hidden_states"] --> SPLIT["(텍스트, 이미지) 분리"]
  SPLIT --> TXT["텍스트 임베딩"]
  SPLIT --> IMG["이미지 임베딩 ip_hidden_states"]
  HS["hidden_states"] --> Q["query = to_q(hidden_states)"]
  TXT --> TK["key = to_k(txt), value = to_v(txt)"]
  Q --> A1["SDPA(query, key, value)"]
  TK --> A1
  A1 --> H0["hidden_states (텍스트 결과)"]
  IMG --> IK["ip_key = to_k_ip(img)<br/>ip_value = to_v_ip(img)"]
  Q --> A2["SDPA(query, ip_key, ip_value)"]
  IK --> A2
  A2 --> SC{"scale 적용"}
  H0 --> ADD["hidden = hidden + scale · ip_result"]
  SC --> ADD
  ADD --> OUT["to_out 투영"]`,
    },
  },
  // 3 — application: load_ip_adapter + set_ip_adapter_scale
  {
    text: "실전에선 위 프로세서 교체를 손으로 안 해 — load_ip_adapter 한 줄이 U-Net의 cross-attention 프로세서들을 IPAdapterAttnProcessor2_0로 싹 바꾸고 to_k_ip/to_v_ip 가중치까지 채워줘. IP-Adapter의 진짜 쓸모는 '말로 못 적는 걸 이미지로 지정'하는 거야 — 참조 이미지 한 장의 스타일·구도·얼굴을 그대로 끌고 와. set_ip_adapter_scale은 아까 __call__에서 본 그 scale이야: 1.0이면 이미지만, 0.5쯤이면 텍스트와 균형. 한 발 더 가면 블록별로 다른 스케일을 줘서 '구도만' 혹은 '스타일만' 가져오는 정교한 제어도 돼. ip_adapter_image에 참조를 넘기는 게 곧 '이미지 프롬프트'야.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "체크포인트에 맞는 text2image 파이프라인을 자동 선택",
        use: "load_ip_adapter / set_ip_adapter_scale / ip_adapter_image 호출의 베이스",
      },
      {
        name: "load_image",
        what: "URL·경로에서 PIL 이미지를 불러오는 헬퍼",
        use: "스타일 참조 이미지를 읽어 ip_adapter_image=로 전달",
      },
    ],
  },
];

export default explanations;
