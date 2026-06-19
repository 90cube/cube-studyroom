import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — load_lora_weights usage
  {
    text: "LoRA 끼우는 건 정말 한 줄이야. 파이프라인을 평소처럼 불러놓고 load_lora_weights에 Hub 리포 이름(+weight_name)만 주면, U-Net이랑 텍스트 인코더의 해당 레이어들에 저랭크 행렬이 자동으로 꽂혀. adapter_name을 꼭 붙여둬 — 안 붙이면 default_0 같은 이름이 자동으로 생기는데, 나중에 여러 개 조합하거나 켜고 끄려면 이름이 있어야 편해. 이제 프롬프트에 그 LoRA가 학습한 트리거를 쓰면 스타일이 입혀져.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "모델 종류 자동 판별 텍스트→이미지 파이프라인",
        use: "SDXL을 불러와 load_lora_weights 로 어댑터를 끼움",
      },
      {
        name: "torch",
        what: "텐서·GPU·반정밀도",
        use: "float16·cuda 배치",
      },
    ],
  },
  // 1 — load_lora_weights internals (algorithm)
  {
    text: "겉보기 한 줄 뒤에서 load_lora_weights가 하는 일은 의외로 단순해. 먼저 PEFT 백엔드가 깔려 있는지 확인하고(없으면 에러), safetensors나 dict를 lora_state_dict로 읽어 state_dict·network_alphas·metadata를 뽑아. 그다음 모든 키에 'lora' 문자열이 있는지로 포맷을 검증하고 — 아니면 잘못된 체크포인트야 — 마지막에 둘로 나눠 주입해: load_lora_into_unet으로 U-Net에, load_lora_into_text_encoder로 텍스트 인코더에. 즉 이 함수는 '읽고·검증하고·둘로 분배'만 하고, 실제 끼우기는 다음 셀의 PEFT가 맡아.",
    diagram: {
      title: "load_lora_weights 흐름",
      kind: "algorithm",
      summary: `flowchart TD
  IN["리포/경로/dict"] --> CHK{"PEFT 백엔드 ?"}
  CHK -->|없음| ERR["ValueError"]
  CHK -->|있음| SD["lora_state_dict()<br/>→ state_dict·alphas·metadata"]
  SD --> FMT{"모든 키에 'lora' ?"}
  FMT -->|아니오| BAD["Invalid LoRA checkpoint"]
  FMT -->|예| SPLIT["U-Net / TE 로 분배"]
  SPLIT --> U["load_lora_into_unet"]
  SPLIT --> T["load_lora_into_text_encoder"]`,
    },
  },
  // 2 — PEFT injection internals (algorithm)
  {
    text: "진짜 주입이 일어나는 곳이야. PeftAdapterMixin.load_lora_adapter가 state_dict의 lora_B 텐서 차원(val.shape[1])을 보고 레이어별 LoRA 랭크를 거꾸로 추론해. 그 랭크랑 알파로 LoraConfig를 만들고 — 여기까지가 diffusers의 일, 즉 '어디에 어떤 모양으로'를 정하는 거야. 그다음 CPU offload 중이면 훅을 잠깐 떼고(안 그러면 주입이 깨져), PEFT의 inject_adapter_in_model로 빈 LoRA 모듈 자리를 모델에 심은 뒤 set_peft_model_state_dict로 실제 가중치를 채워. 한마디로 diffusers는 설계도를 그리고, 끼우는 손은 PEFT야.",
    diagram: {
      title: "PEFT 어댑터 주입",
      kind: "algorithm",
      summary: `flowchart TD
  SD["state_dict"] --> R["lora_B 차원으로<br/>레이어별 rank 추론"]
  R --> CFG["_create_lora_config<br/>→ LoraConfig"]
  CFG --> OFF["offload 훅 임시 해제"]
  OFF --> INJ["inject_adapter_in_model<br/>(빈 LoRA 모듈 심기)"]
  INJ --> SET["set_peft_model_state_dict<br/>(가중치 채우기)"]`,
      detail: `flowchart TD
  SD["state_dict 키 순회"] --> F{"lora_B 이고 ndim>1 ?"}
  F -->|예| RK["rank[key] = val.shape[1]"]
  F -->|아니오| SKIP["건너뜀"]
  RK --> CFG["_create_lora_config(rank, alphas, metadata)"]
  SKIP --> CFG
  CFG --> O["_optionally_disable_offloading"]
  O --> H{"hotswap ?"}
  H -->|예| HS["hotswap_adapter_from_state_dict<br/>(기존 어댑터 자리 교체)"]
  H -->|아니오| IN["inject_adapter_in_model"]
  IN --> PS["set_peft_model_state_dict<br/>→ incompatible_keys 확인"]
  HS --> DONE["_hf_peft_config_loaded = True"]
  PS --> DONE`,
    },
  },
  // 3 — set_adapters (multiple LoRA)
  {
    text: "이게 LoRA를 진짜 써먹는 방식이야. 이름 붙여 두 개를 올린 다음 set_adapters에 이름 리스트랑 adapter_weights를 줘 — 'ikea 0.7 + feng 0.8'처럼 누구를 얼마나 섞을지 레시피를 짜는 거지. 소스에서 set_adapters는 weights를 어댑터 수만큼 리스트로 펼치고(None은 1.0으로 채움), 모델별 스케일 확장 함수를 거친 뒤 set_weights_and_activate_adapters로 활성화해. 실전에서 제일 많이 쓰는 패턴이 '캐릭터 일관성 LoRA + 화풍 LoRA'를 분리해서 비중으로 조절하는 거야. set_adapters에 문자열 하나만 주면 그것만 켜지고, disable_lora()로 전부 끌 수도 있어.",
  },
  // 4 — fuse_lora
  {
    text: "배포용 최적화야. LoRA를 켜둔 채 추론하면 매 스텝마다 W·x 말고 (W + scale·B·A)·x를 계산하느라 분기가 하나 더 생겨서 약간 느려. fuse_lora는 아예 W ← W + scale·B·A로 본체 가중치에 더해버려서 그 분기를 없애 — 소스를 보면 모델의 모든 PEFT 레이어(BaseTunerLayer)를 순회하면서 scale_layer로 세기를 적용하고 module.merge()를 불러. 합치고 나면 unload_lora_weights로 LoRA 객체를 떼고 save_pretrained 하면, 어댑터 없이도 그 스타일이 박힌 단일 모델이 돼. 로드 한 번에 분기 0이라 서빙이 빨라지고 메모리도 줄어. 단일 LoRA만 융합했다면 unfuse_lora로 되돌릴 수 있어.",
  },
  // 5 — textual inversion
  {
    text: "textual inversion은 LoRA랑 결이 달라. 가중치를 끼우는 게 아니라 '새 단어 임베딩' 하나만 토큰 테이블에 추가하는 거야. load_textual_inversion으로 .pt/.safetensors를 올리면서 token=\"<cat-toy>\" 같은 이름을 지정하면, 프롬프트에 그 토큰을 쓰는 순간 학습된 개념(특정 인물·오브젝트·화풍)이 호출돼. 모델 본체는 1바이트도 안 바뀌고 사전에 단어만 하나 는 셈이라 파일이 아주 작아. 실전에선 EasyNegative 같은 부정 임베딩을 올려 negative_prompt에서 불러 품질을 끌어올리는 용도로도 엄청 많이 써.",
  },
];

export default explanations;
