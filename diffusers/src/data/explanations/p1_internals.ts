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
  },
  // 1 — encode / decode
  "루프는 'latent 공간'에서 돌아. 그래서 앞뒤로 변환이 필요해: 들어오기 전 encode_prompt가 프롬프트를 CLIP으로 임베딩하고, prepare_latents가 순수 노이즈에서 시작점을 만들어. 루프가 끝나면 vae.decode가 깨끗해진 latent를 실제 이미지 픽셀로 되돌려 — scaling_factor로 나눠주는 건 VAE가 학습된 스케일에 맞추는 거야.",
];

export default explanations;
