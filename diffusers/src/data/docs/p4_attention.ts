import type { StudyDoc } from "@/models/study";

// 소스: diffusers/src/diffusers/models/attention_processor.py
// 핵심 발췌 — AttnProcessor2_0.__call__ (self/cross), IPAdapterAttnProcessor2_0 (swap 확장점).

const doc: StudyDoc = {
  id: "p4-attention",
  title: "어텐션 · 조건화",
  cells: [
    {
      type: "markdown",
      source:
        "## 사용법 — 어텐션 계산은 '프로세서'로 갈아끼운다\n diffusers의 모든 `Attention` 레이어는 실제 Q·K·V 계산을 **processor 객체에 위임**한다. PyTorch 2.0이면 기본값이 `AttnProcessor2_0`(SDPA 사용). U-Net 전체의 프로세서를 한 번에 바꿀 수 있는데(`set_attn_processor`), 이 한 줄짜리 후크가 IP-Adapter·LoRA·어텐션 슬라이싱 같은 확장이 전부 끼어드는 자리다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import StableDiffusionPipeline
from diffusers.models.attention_processor import AttnProcessor2_0

pipe = StableDiffusionPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5", torch_dtype=torch.float16
).to("cuda")

# 현재 U-Net에 깔린 어텐션 프로세서들을 본다 (이름 -> 프로세서)
print(list(pipe.unet.attn_processors.keys())[:3])

# 전부 명시적으로 SDPA 프로세서로 교체 (보통 자동이지만, 이렇게 직접 꽂을 수 있다)
pipe.unet.set_attn_processor(AttnProcessor2_0())`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 ① — self vs cross는 K·V를 어디서 뽑느냐로 갈린다\n`AttnProcessor2_0.__call__`의 핵심 6줄. Query는 **항상** 이미지 latent(`hidden_states`)에서 뽑는다. 갈림길은 K·V다: `encoder_hidden_states`가 **없으면** 자기 자신을 쓴다 → **self-attention**(픽셀끼리 관계). **있으면**(=텍스트 임베딩) 거기서 K·V를 뽑는다 → **cross-attention**. 즉 같은 코드가 텍스트를 받았는지 여부만으로 self/cross를 오간다 — 텍스트가 이미지를 조종하는 바로 그 메커니즘이다.",
    },
    {
      type: "code",
      source: `# attention_processor.py — AttnProcessor2_0.__call__ (핵심 발췌)
query = attn.to_q(hidden_states)                      # Q: 항상 이미지 latent에서

if encoder_hidden_states is None:
    encoder_hidden_states = hidden_states             # self-attention: 자기 자신
elif attn.norm_cross:
    encoder_hidden_states = attn.norm_encoder_hidden_states(encoder_hidden_states)

key = attn.to_k(encoder_hidden_states)                # K,V: 텍스트면 텍스트에서 (cross)
value = attn.to_v(encoder_hidden_states)

inner_dim = key.shape[-1]
head_dim = inner_dim // attn.heads
query = query.view(batch_size, -1, attn.heads, head_dim).transpose(1, 2)   # 멀티헤드로 분할
key = key.view(batch_size, -1, attn.heads, head_dim).transpose(1, 2)
value = value.view(batch_size, -1, attn.heads, head_dim).transpose(1, 2)

# softmax(Q·Kᵀ / √d)·V 를 PyTorch 2.0 커널로 한 방에
hidden_states = F.scaled_dot_product_attention(
    query, key, value, attn_mask=attention_mask, dropout_p=0.0, is_causal=False
)
hidden_states = hidden_states.transpose(1, 2).reshape(batch_size, -1, attn.heads * head_dim)
hidden_states = attn.to_out[0](hidden_states)         # 출력 투영`,
    },
    {
      type: "markdown",
      source:
        "## 내부 동작 ② — 프로세서만 갈아끼우면 IP-Adapter가 된다\n`IPAdapterAttnProcessor2_0`는 위 프로세서를 복제하되 **이미지 프롬프트용 K·V 투영(`to_k_ip`/`to_v_ip`)을 추가**한다. 텍스트로 한 번 cross-attention을 돌리고, **같은 Query로 이미지 임베딩에 대해 한 번 더** 어텐션을 돌린 뒤 둘을 `scale`로 섞는다. 본체 가중치는 안 건드리고 작은 투영 두 개만 더한 것 — \"프로세서 교체\"가 곧 새 조건화 채널을 여는 확장점이라는 증거다.",
    },
    {
      type: "code",
      source: `# attention_processor.py — IPAdapterAttnProcessor2_0 (핵심 발췌)
def __init__(self, hidden_size, cross_attention_dim=None, num_tokens=(4,), scale=1.0):
    super().__init__()
    # 이미지 프롬프트 전용 K·V 투영을 새로 단다 (텍스트용 to_k/to_v 와 별개)
    self.to_k_ip = nn.ModuleList([nn.Linear(cross_attention_dim, hidden_size, bias=False)
                                  for _ in range(len(num_tokens))])
    self.to_v_ip = nn.ModuleList([nn.Linear(cross_attention_dim, hidden_size, bias=False)
                                  for _ in range(len(num_tokens))])
    self.scale = scale

def __call__(self, attn, hidden_states, encoder_hidden_states=None, ...):
    # encoder_hidden_states 에서 텍스트와 이미지 임베딩을 분리
    encoder_hidden_states, ip_hidden_states = encoder_hidden_states

    # 1) 텍스트로 평소처럼 cross-attention (to_q / to_k / to_v + SDPA) ...
    #    -> hidden_states  (위 AttnProcessor2_0 와 동일)

    # 2) 같은 query 로 이미지 임베딩에 대해 한 번 더 어텐션
    for current_ip_hidden_states, scale, to_k_ip, to_v_ip, mask in zip(...):
        ip_key = to_k_ip(current_ip_hidden_states)
        ip_value = to_v_ip(current_ip_hidden_states)
        ip_key = ip_key.view(batch_size, -1, attn.heads, head_dim).transpose(1, 2)
        ip_value = ip_value.view(batch_size, -1, attn.heads, head_dim).transpose(1, 2)
        current = F.scaled_dot_product_attention(query, ip_key, ip_value,
                                                 attn_mask=None, dropout_p=0.0, is_causal=False)
        # 3) 텍스트 결과 + scale * 이미지 결과
        hidden_states = hidden_states + scale * current`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — '이미지 프롬프트'로 스타일/얼굴을 가져오기\nIP-Adapter의 실전 가치는 \"말로 못 적는 걸 이미지로 지정\"하는 것이다. 참조 이미지 한 장을 주면 그 스타일/구도/얼굴을 따라간다. 위에서 본 프로세서 교체를 `load_ip_adapter` 한 줄이 알아서 해 주고, `set_ip_adapter_scale`이 위 코드의 `scale`(텍스트↔이미지 균형)을 조절한다. 블록별로 다른 스케일을 주면 \"구도만 / 스타일만\" 같은 정교한 제어도 된다.",
    },
    {
      type: "code",
      source: `import torch
from diffusers import AutoPipelineForText2Image
from diffusers.utils import load_image

pipe = AutoPipelineForText2Image.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5", torch_dtype=torch.float16
).to("cuda")

# 내부적으로 cross-attention 프로세서들을 IPAdapterAttnProcessor2_0 로 교체한다
pipe.load_ip_adapter("h94/IP-Adapter", subfolder="models",
                     weight_name="ip-adapter_sd15.bin")

# scale = 위 __call__ 의 텍스트↔이미지 균형 (1.0=이미지만, 0.5=균형)
pipe.set_ip_adapter_scale(0.6)

ref = load_image("style_reference.png")
image = pipe(
    prompt="a dog, autumn leaves in the background",
    ip_adapter_image=ref,         # '이미지 프롬프트'
).images[0]`,
    },
  ],
};

export default doc;
