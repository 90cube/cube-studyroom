import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — denoising loop
  {
    text: "이게 그림이 만들어지는 심장부야. 정해진 timesteps를 돌면서 매 스텝: (CFG면 latent를 2배 복제해) U-Net한테 '지금 낀 노이즈 예측해' 시키고 — 이때 텍스트 임베딩을 encoder_hidden_states로 같이 넘겨 조건화해 — guidance로 텍스트 방향으로 밀어준 뒤, 스케줄러한테 'x_t에서 x_(t-1)로 한 칸 디노이즈' 시켜. 이걸 T번 반복하면 노이즈가 깨끗한 latent가 돼.",
    diagram: {
      title: "파이프라인 전체 흐름",
      kind: "algorithm",
      summary: `flowchart TD
  P["프롬프트"] --> E["CLIP 텍스트 인코딩"]
  N["순수 노이즈 latent"] --> L["denoising 루프 (T스텝)"]
  E --> L
  L --> D["VAE 디코딩"]
  D --> IMG["이미지"]`,
      detail: `flowchart TD
  S["latents (노이즈)"] --> CFG["CFG면 latent 2배 복제"]
  CFG --> U["U-Net: 노이즈 예측<br/>encoder_hidden_states = 텍스트"]
  U --> G{"CFG ?"}
  G -->|예| MIX["uncond + scale·(text − uncond)"]
  G -->|아니오| KEEP["noise_pred 그대로"]
  MIX --> STEP["scheduler.step: x_t → x_(t-1)"]
  KEEP --> STEP
  STEP --> Q{"스텝 남음 ?"}
  Q -->|예| S
  Q -->|아니오| OUT["깨끗한 latent"]`,
    },
    lines: {
      3: "CFG면 latent를 [uncond, text] 2배로 복제해 한 번의 U-Net 호출로 두 방향을 동시에 예측.",
      9: "encoder_hidden_states=prompt_embeds: 텍스트 임베딩을 U-Net의 cross-attention에 꽂아 '뭘 그릴지' 조건화.",
      16: "guidance: uncond에서 (text−uncond) 방향으로 scale만큼 더 밀어 — 프롬프트 충실도(CFG)의 실체.",
      19: "scheduler.step: 예측 노이즈로 x_t를 x_(t-1)로 한 칸 디노이즈. 이 줄이 루프의 실제 전진.",
    },
  },
  // 1 — encode / decode
  {
    text: "루프는 'latent 공간'에서 돌아. 그래서 앞뒤로 변환이 필요해: 들어오기 전 encode_prompt가 프롬프트를 CLIP으로 임베딩하고, prepare_latents가 순수 노이즈에서 시작점을 만들어. 루프가 끝나면 vae.decode가 깨끗해진 latent를 실제 이미지 픽셀로 되돌려 — scaling_factor로 나눠주는 건 VAE가 학습된 스케일에 맞추는 거야.",
    lines: {
      2: "encode_prompt: 프롬프트를 CLIP 텍스트 인코더로 임베딩 — 위 루프의 encoder_hidden_states가 바로 이거.",
      5: "prepare_latents: 순수 가우시안 노이즈로 루프의 출발점 x_T를 만들어.",
      10: "vae.decode: 깨끗해진 latent를 픽셀 이미지로 복원. scaling_factor로 나누는 건 VAE 학습 스케일에 맞추는 보정.",
    },
  },
];

export default explanations;
