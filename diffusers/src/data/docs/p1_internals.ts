import type { StudyDoc } from "@/models/study";

const doc: StudyDoc = {
  id: "p1-internals",
  title: "내부 동작",
  cells: [
    { type: "markdown", source: "## `__call__` 안에서 무슨 일이?\n핵심은 가운데의 **denoising 루프**다. 아래는 `StableDiffusionPipeline.__call__`의 실제 루프를 추린 것." },
    {
      type: "code",
      source: `for i, t in enumerate(timesteps):
    # classifier-free guidance면 latent를 2배로 복제 (uncond + text)
    latent_model_input = torch.cat([latents] * 2) if self.do_classifier_free_guidance else latents
    latent_model_input = self.scheduler.scale_model_input(latent_model_input, t)

    # U-Net이 이 스텝의 노이즈를 예측 (텍스트를 cross-attention으로 주입)
    noise_pred = self.unet(
        latent_model_input, t,
        encoder_hidden_states=prompt_embeds,
        return_dict=False,
    )[0]

    # guidance: 텍스트 방향으로 더 밀어주기
    if self.do_classifier_free_guidance:
        noise_pred_uncond, noise_pred_text = noise_pred.chunk(2)
        noise_pred = noise_pred_uncond + self.guidance_scale * (noise_pred_text - noise_pred_uncond)

    # 스케줄러가 x_t -> x_{t-1} 한 칸 디노이즈
    latents = self.scheduler.step(noise_pred, t, latents, return_dict=False)[0]`,
    },
    { type: "markdown", source: "## 루프 앞뒤 — 인코딩과 디코딩\n루프는 latent 공간에서 돈다. 들어올 땐 텍스트를 임베딩으로, 나갈 땐 latent를 이미지로 바꾼다." },
    {
      type: "code",
      source: `# 1) 프롬프트 -> 임베딩 (CLIP 텍스트 인코더)
prompt_embeds, negative_prompt_embeds = self.encode_prompt(prompt, ...)

# 2) 시작 latent 준비 (순수 노이즈)
latents = self.prepare_latents(...)

# ... (위의 denoising 루프 실행) ...

# 3) 깨끗해진 latent -> 이미지 (VAE 디코더)
image = self.vae.decode(latents / self.vae.config.scaling_factor, return_dict=False)[0]`,
    },
  ],
};

export default doc;
