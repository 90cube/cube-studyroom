import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p7-loaders",
  title: "내용",
  cells: [
    {
      type: "markdown",
      source:
        "## 어댑터 = 본체는 그대로, 작은 가중치만 끼우기\nLoRA·textual inversion·IP-Adapter는 전체 모델을 재학습하지 않고 **작은 가중치 묶음**만 본체에 주입한다. LoRA는 각 Linear/Conv 옆에 저랭크 행렬 두 개(A·B)를 붙여 `W + scale·B·A`로 출력을 살짝 비튼다. diffusers의 loader는 이 주입을 PEFT 백엔드에 위임한다.",
    },
    {
      type: "markdown",
      source:
        "## 사용법 — LoRA 한 줄로 끼우기\n`load_lora_weights`에 Hub 리포나 로컬 safetensors 경로만 주면 U-Net과 텍스트 인코더에 알아서 꽂힌다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16
).to("cuda")

# LoRA 가중치 주입 (U-Net + text encoder에 자동 배선)
pipe.load_lora_weights(
    "ostris/ikea-instructions-lora-sdxl",
    weight_name="ikea_instructions_xl_v1_5.safetensors",
    adapter_name="ikea",          # 이름을 붙여두면 나중에 조합/스위칭 가능
)

image = pipe("a castle, IKEA instructions style").images[0]`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 1 — `load_lora_weights`는 state_dict를 읽어 U-Net/TE에 분배\n실제 소스(`lora_pipeline.py`)는 단순하다: 가중치를 `lora_state_dict`로 읽어 형식을 검증하고, U-Net용·텍스트 인코더용으로 나눠 각각 주입한다.",
    },
    {
      type: "code",
      source: `def load_lora_weights(self, pretrained_model_name_or_path_or_dict, adapter_name=None,
                      hotswap=False, **kwargs):
    if not USE_PEFT_BACKEND:
        raise ValueError("PEFT backend is required for this method.")

    # 1) safetensors/dict -> state_dict + network_alphas + metadata
    state_dict, network_alphas, metadata = self.lora_state_dict(
        pretrained_model_name_or_path_or_dict, **kwargs)

    # 2) 모든 키에 'lora' 가 들어있는 올바른 포맷인지 검증
    is_correct_format = all("lora" in key for key in state_dict.keys())
    if not is_correct_format:
        raise ValueError("Invalid LoRA checkpoint.")

    # 3) U-Net 쪽 주입
    self.load_lora_into_unet(state_dict, network_alphas=network_alphas,
        unet=self.unet, adapter_name=adapter_name, metadata=metadata, _pipeline=self)
    # 4) 텍스트 인코더 쪽 주입
    self.load_lora_into_text_encoder(state_dict, network_alphas=network_alphas,
        text_encoder=self.text_encoder, lora_scale=self.lora_scale,
        adapter_name=adapter_name, _pipeline=self, metadata=metadata)`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 2 — 실제 주입은 PEFT가 한다\n`PeftAdapterMixin.load_lora_adapter`(`peft.py`)가 state_dict에서 LoRA 랭크를 추론해 `LoraConfig`를 만들고, PEFT의 `inject_adapter_in_model`로 모듈을 끼운 뒤 `set_peft_model_state_dict`로 가중치를 채운다. diffusers는 '어디에 무엇을' 정하고, 끼우는 손은 PEFT다.",
    },
    {
      type: "code",
      source: `# peft.py — load_lora_adapter 핵심부 발췌
from peft import inject_adapter_in_model, set_peft_model_state_dict

# state_dict의 lora_B 차원에서 각 레이어 랭크를 추론
rank = {}
for key, val in state_dict.items():
    if "lora_B" in key and val.ndim > 1:
        rank[f"^{key}"] = val.shape[1]

# 추론한 랭크/알파로 LoraConfig 생성
lora_config = _create_lora_config(state_dict, network_alphas, metadata, rank,
    model_state_dict=self.state_dict(), adapter_name=adapter_name)

# CPU offload 중이면 잠시 훅 해제 (안 그러면 주입이 깨짐)
is_model_cpu_offload, is_seq_cpu_offload, is_group = \\
    self._optionally_disable_offloading(_pipeline)

# 1) 모듈 자리를 모델에 주입  2) 가중치를 채움
inject_adapter_in_model(lora_config, self, adapter_name=adapter_name, state_dict=state_dict)
incompatible_keys = set_peft_model_state_dict(self, state_dict, adapter_name)`,
    },
    {
      type: "markdown",
      source:
        "## 응용 1 — 여러 LoRA 조합하고 비중 주기 (`set_adapters`)\n이름을 붙여 여러 LoRA를 동시에 올리고, `set_adapters`로 누구를 얼마나 섞을지 정한다. 소스에서 `set_adapters`는 가중치를 어댑터 수만큼 리스트로 펼친 뒤 `set_weights_and_activate_adapters`로 활성화한다. '스타일 A 0.7 + 캐릭터 B 0.8'처럼 레시피를 짜는 방식 — 캐릭터 일관성 + 화풍 분리에 실전에서 가장 많이 쓰인다.",
    },
    {
      type: "code",
      source: `# 두 개의 LoRA를 각각 이름 붙여 로드
pipe.load_lora_weights("ostris/ikea-instructions-lora-sdxl",
    weight_name="ikea_instructions_xl_v1_5.safetensors", adapter_name="ikea")
pipe.load_lora_weights("lordjia/by-feng-zikai",
    weight_name="fengzikai_v1.0_XL.safetensors", adapter_name="feng")

# 둘을 동시에 활성화하고 비중 지정
pipe.set_adapters(["ikea", "feng"], adapter_weights=[0.7, 0.8])
image = pipe("a panda, IKEA instructions, by Feng Zikai").images[0]

# 하나만 다시 켜기 / 전부 끄기
pipe.set_adapters("ikea")
pipe.disable_lora()`,
    },
    {
      type: "markdown",
      source:
        "## 응용 2 — 배포용으로 LoRA를 본체에 굽기 (`fuse_lora`)\n매 추론마다 LoRA 분기를 거치면 약간 느리다. `fuse_lora`는 `W ← W + scale·B·A`로 가중치를 **본체에 직접 합쳐** 분기를 없앤다(소스: 각 PEFT 레이어를 순회하며 `module.merge()` 호출). 합친 뒤 `unload_lora_weights`로 LoRA 객체를 떼고 `save_pretrained`하면, 어댑터 없이도 그 스타일이 박힌 단일 모델이 된다 — 서빙 최적화의 정석.",
    },
    {
      type: "code",
      source: `# 선택한 어댑터들을 본체 가중치에 융합
pipe.fuse_lora(adapter_names=["ikea", "feng"], lora_scale=1.0)
pipe.unload_lora_weights()          # 이제 LoRA 분기 불필요
pipe.save_pretrained("fused-sdxl-ikea-feng")
# 로드 1번 + 분기 0 -> 추론 빠르고 메모리 적음

# 되돌리고 싶으면 (단일 LoRA만 융합한 경우)
# pipe.unfuse_lora()`,
    },
    {
      type: "markdown",
      source:
        "## 응용 3 — Textual Inversion (새 토큰 하나로 개념 주입)\nLoRA가 가중치를 끼운다면, textual inversion은 **새 단어 임베딩** 하나만 추가한다. `load_textual_inversion`으로 `.pt`/`.safetensors`를 올리고 `token`을 지정하면, 프롬프트에 그 토큰을 쓰는 순간 학습된 개념(특정 인물·스타일·오브젝트)이 호출된다. 부정 임베딩(easynegative 등)으로 품질을 끌어올리는 데도 흔히 쓴다.",
    },
    {
      type: "code",
      source: `# 학습된 임베딩을 토큰으로 등록
pipe.load_textual_inversion(
    "sd-concepts-library/cat-toy", token="<cat-toy>"
)
image = pipe("a <cat-toy> sitting on a table").images[0]

# 부정 임베딩도 같은 방식 (negative_prompt에서 호출)
pipe.load_textual_inversion("embed/EasyNegative", token="EasyNegative")
image = pipe("portrait", negative_prompt="EasyNegative").images[0]`,
    },
  ],
};

export default doc;
