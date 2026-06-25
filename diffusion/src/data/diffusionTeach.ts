// Teach-method 보강 데이터 (diffusion 토픽).
// - DIFFUSION_MISSION: "왜 디퓨전을 배우나" — 토픽 단위 동기 (구어체).
// - DIFFUSION_TEACH: 파트별 1차 출처 1개 + 인출연습(recall) 카드.
// 모든 recall 정답은 검증된 explanations/*.ts 근거. 모든 URL은 canonical(논문 arXiv·공식 문서)
// 또는 해당 파트의 실제 영상 URL. 추측·환각 URL 없음.

import type { PartTeach } from "@/models/teach";

export const DIFFUSION_MISSION = `너는 지금 sd.cpp + SD1.5로 **네 손으로 픽셀·스프라이트 시트 생성기**를 짜고 있어. 그 엔진 안에서 도는 게 바로 디퓨전이야 — 노이즈를 더했다 걷어내는 그 원리, latent에서 도는 이유, CLIP·CFG·ControlNet·LoRA가 뭘 어떻게 조종하는지. 이걸 블랙박스로 두면 "왜 이 그림이 나왔는지", "스텝·guidance·LoRA scale을 어디로 돌려야 하는지"를 영영 감으로만 만지게 돼. 이 10파트를 통과하면 forward/reverse부터 추론 최적화까지 전 구간이 머릿속에 펼쳐져서, 네 툴을 진짜로 **조종**할 수 있게 된다.`;

export const DIFFUSION_TEACH: Record<number, PartTeach> = {
  // Part 1 — Simple Diffusion (forward/reverse, noise schedule, ε-prediction)
  1: {
    primarySource: {
      title: "Denoising Diffusion Probabilistic Models (DDPM, Ho et al. 2020)",
      url: "https://arxiv.org/abs/2006.11239",
      why: "이 파트가 그대로 구현하는 forward/reverse·노이즈 스케줄·ε예측의 원전이야 — 디퓨전의 헌법.",
    },
    recall: [
      {
        q: "학습 때 모델한테 정확히 뭘 맞히라고 시키지? 손실(loss)은 무엇과 무엇 사이로 재나?",
        a: "각 timestep에서 데이터에 더해진 '노이즈(ε)'를 예측하라고 시킨다(ε-prediction). 손실은 예측 노이즈 vs 실제 더한 노이즈의 MSE.",
        hint: "모델이 깨끗한 데이터를 직접 뱉는 게 아니야 — 더해진 무언가를 맞힌다.",
      },
      {
        q: "원본 x₀에서 임의의 t단계 노이즈 데이터 x_t를 한 방에 만드는 공식은? 거기 ᾱ_t(누적 alpha)는 어떻게 나오나?",
        a: "x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·노이즈. ᾱ_t는 alpha(=1−β)들의 누적곱(cumprod)으로, t단계까지 원본이 얼마나 살아남는지를 나타낸다.",
        hint: "β로 alpha를 만들고, alpha를 쭉 곱해.",
      },
      {
        q: "학습할 때는 t를 어떻게 고르고, 생성(샘플링)할 때는 t를 어떻게 훑지? 왜 다를까?",
        a: "학습은 매 스텝 t를 무작위로 뽑아 전 구간을 골고루 익힌다. 생성은 반드시 T−1→0으로 한 단계씩 거꾸로 내려와야 노이즈가 데이터로 복원된다.",
      },
    ],
  },

  // Part 2 — MNIST Diffusion (U-Net denoiser, DDPM loop, diffusers)
  2: {
    primarySource: {
      title: "Hugging Face Diffusers — Train a diffusion model (튜토리얼)",
      url: "https://huggingface.co/docs/diffusers/tutorials/basic_training",
      why: "scratch DDPM 루프를 UNet2DModel·DDPMScheduler로 옮기는 이 파트의 후반부와 1:1로 겹치는 공식 가이드야.",
    },
    recall: [
      {
        q: "U-Net에서 내리막(down)과 오르막(up) 사이를 잇는 'skip 연결'은 왜 필요하지?",
        a: "내리막에서 해상도를 줄이며 잃은 디테일을, 같은 해상도의 오르막에 그 특징을 그대로 더해(skip) 되살리기 위해서다.",
        hint: "압축하면 잃는 게 있어. 그걸 다시 끼워넣는 통로.",
      },
      {
        q: "U-Net에 '지금 몇 번째 단계인지(t)'와 '어떤 클래스인지'는 어떻게 집어넣나?",
        a: "각각 작은 MLP로 임베딩 벡터로 바꾼 뒤, 특징맵에 더해(주입) 모델이 시간 감각과 클래스 조건을 동시에 갖게 한다.",
      },
      {
        q: "맨바닥 PyTorch 구현을 diffusers의 UNet2DModel·DDPMScheduler로 바꾸면 무엇이 사라지고 무엇은 그대로 남나?",
        a: "노이즈 스케줄 계산·forward 공식·역확산 step 같은 보일러플레이트는 라이브러리가 감춰 코드가 짧아진다. 하지만 'ε를 예측하고 MSE로 학습'하는 원리 자체는 그대로다.",
        hint: "추상화가 감추는 건 절차지, 원리가 아냐.",
      },
    ],
  },

  // Part 3 — Celeb Faces (scratch training, gradient accumulation, step budget)
  3: {
    primarySource: {
      title: "셀럽 얼굴 파인튜닝 (강의 영상)",
      url: "https://youtu.be/05yjbi-ySR4",
      why: "작은 VRAM으로 큰 얼굴 모델을 굴리는 실전 학습 테크닉(누적 배치·스텝 예산·모니터링)을 이 영상이 그대로 시연해.",
    },
    recall: [
      {
        q: "큰 이미지라 batch_size를 작게(예: 4) 둘 수밖에 없을 때, '큰 배치 효과'를 내는 테크닉 두 가지는?",
        a: "(1) gradient accumulation — 작은 배치들의 기울기를 모아 한 번에 갱신. (2) 스텝 예산 방식 — 에폭 대신 'num_steps < 5만'처럼 작은 배치로 스텝을 잔뜩 밟아 누적 학습량을 채운다.",
        hint: "기울기를 모으거나, 스텝을 많이 밟거나.",
      },
      {
        q: "이 파트는 학습 중 주기적으로 무엇을 하지? 왜 그게 중요한가?",
        a: "수백 스텝마다 샘플 이미지를 생성(모니터링)한다. 얼굴이 점점 또렷해지는지로 학습이 제대로 가는지 눈으로 확인하고, 망가지면 일찍 잡기 위해서다.",
      },
    ],
  },

  // Part 4 — Image Editing (inpainting, masks, blended diffusion / RePaint)
  4: {
    primarySource: {
      title: "RePaint: Inpainting using Denoising Diffusion Probabilistic Models",
      url: "https://arxiv.org/abs/2201.09865",
      why: "이 파트의 인페인팅 루프가 그대로 따르는 'blended diffusion'(매 스텝 마스크로 합성) 방식의 원전이야.",
    },
    recall: [
      {
        q: "인페인팅 루프의 '심장' 한 줄을 말로 풀면? 매 스텝 마스크 안/밖을 어떻게 처리하지?",
        a: "매 스텝 마스크 '유지' 영역엔 같은 시각 t로 노이즈 입힌 원본을 끼워넣고, '생성' 영역엔 모델이 디노이즈한 결과를 넣어 둘을 합친다(x_t = 모델·inv_mask + 노이즈원본·mask).",
        hint: "원본도 똑같은 노이즈 레벨로 맞춰서 섞어.",
      },
      {
        q: "왜 원본을 그냥 끼워넣지 않고, '지금 시각 t에 맞는 양만큼' 노이즈를 다시 입혀서 합치나?",
        a: "생성 중인 latent와 노이즈 레벨을 맞춰야 합쳤을 때 이음매가 어긋나지 않기 때문이다. 같은 t 레벨끼리 섞어야 경계가 자연스럽다.",
      },
      {
        q: "마스크 경계를 칼처럼 0/1로 두지 않고 gaussian_filter로 부드럽게 번지게 하는 이유는?",
        a: "딱 자른 경계는 합성 이음매가 티 나서다. 경계를 0~1 사이로 번지게 하면 교체 부위와 원본이 자연스럽게 이어진다.",
      },
    ],
  },

  // Part 5 — Latent Diffusion (VAE, latent space, scaling factor)
  5: {
    primarySource: {
      title: "High-Resolution Image Synthesis with Latent Diffusion Models (LDM / Stable Diffusion)",
      url: "https://arxiv.org/abs/2112.10752",
      why: "픽셀 대신 VAE latent에서 확산을 돌리는 이 파트의 핵심 아이디어, 즉 Stable Diffusion의 토대 논문이야.",
    },
    recall: [
      {
        q: "픽셀 공간에서 직접 확산하면 왜 비싸지? 해상도와 메모리는 어떤 관계인가?",
        a: "해상도가 2배가 되면 GPU 메모리가 대략 4배로 폭증한다(메모리 ∝ 해상도²). 그래서 고해상도를 픽셀에서 직접 다루면 금세 VRAM이 터진다.",
        hint: "2배 → 4배. 제곱이야.",
      },
      {
        q: "VAE 인코더는 512×512 이미지를 latent로 만들 때 무엇을 줄이고 무엇은 보존하지? latent의 모양은?",
        a: "공간 크기만 1/8로 줄이고(64×64) 의미는 보존한다. SD1.5 기준 latent는 4채널 → (4, 64, 64).",
      },
      {
        q: "갓 인코딩한 raw latent에 scaling_factor(SD1.5는 ≈0.18215)를 곱하는 이유는?",
        a: "raw latent는 범위가 제멋대로 널뛰는데, 학습 데이터로 잰 표준편차로 나눠 분산을 ≈1로 정돈해야 확산 노이즈 스케줄과 박자가 맞기 때문이다.",
        hint: "노이즈 스케줄은 분산 1짜리 노이즈를 가정해.",
      },
    ],
  },

  // Part 6 — Text Conditioning (CLIP, cross-attention, classifier-free guidance)
  6: {
    primarySource: {
      title: "Classifier-Free Diffusion Guidance (Ho & Salimans 2022)",
      url: "https://arxiv.org/abs/2207.12598",
      why: "이 파트의 핵심인 CFG — '무조건 + scale·(조건−무조건)'로 프롬프트 충실도를 키우는 그 기법의 원전이야.",
    },
    recall: [
      {
        q: "텍스트 프롬프트가 그림을 조종하는 통로는 정확히 어디지? 임베딩은 UNet의 어디로 들어가나?",
        a: "CLIP 텍스트 인코더가 프롬프트를 (77, 768) 임베딩으로 바꾸고, 그게 UNet의 cross-attention으로(encoder_hidden_states) 들어가 각 공간 위치가 토큰을 참조한다.",
        hint: "self-attention 말고, 텍스트를 '바라보는' attention.",
      },
      {
        q: "Classifier-free guidance의 '마법의 한 줄'은? 각 항이 무슨 뜻인가?",
        a: "noise_pred = uncond + scale·(text − uncond). uncond는 무조건(빈 프롬프트) 예측, (text − uncond)는 프롬프트 방향 벡터, scale(guidance_scale, 예: 7.5)이 그 방향을 얼마나 밀지다.",
        hint: "무조건이 기본값, 거기에 프롬프트 방향을 더 밀어.",
      },
      {
        q: "CFG를 쓰려면 한 스텝에 UNet 입력을 왜 두 벌로 만들지? guidance_scale=1이면 어떻게 되나?",
        a: "한 번의 호출로 '조건부 예측'과 '무조건 예측'을 동시에 뽑으려고 latent를 2배 복제한다. scale=1이면 (text−uncond) 항이 1배라 사실상 guidance 없음과 같다.",
      },
    ],
  },

  // Part 7 — ControlNet (structural conditioning, zero-conv, residual injection)
  7: {
    primarySource: {
      title: "Adding Conditional Control to Text-to-Image Diffusion Models (ControlNet)",
      url: "https://arxiv.org/abs/2302.05543",
      why: "얼린 SD에 복사 인코더 분기와 zero-convolution으로 구조 조건을 주입하는 이 파트의 작동 원리 그 자체의 원전이야.",
    },
    recall: [
      {
        q: "ControlNet은 SD 본체를 학습하나? 구조 조건(Canny 엣지 등)은 어떻게 UNet에 반영되지?",
        a: "본체(UNet)는 얼린(freeze) 채 둔다. SD 인코더 복사본이 구조 조건을 받아 down/mid 잔차(residual)를 만들고, 그걸 얼린 UNet의 각 층에 더해(주입) 형태를 따르게 한다.",
        hint: "원본은 안 건드려. 옆에서 보정값만 더해.",
      },
      {
        q: "ControlNet의 'zero-convolution(1×1 conv, 0에서 시작)'은 무슨 역할을 하나?",
        a: "학습 초기에 0에서 시작해 본체 출력을 건드리지 않다가, 점점 구조 조건을 주입하도록 학습된다 — 사전학습 SD를 망가뜨리지 않으면서 제어를 더하는 장치.",
      },
      {
        q: "controlnet_conditioning_scale 다이얼은 무엇을 조절하지? 높이면/낮추면?",
        a: "구조 조건을 얼마나 세게 따를지(주입 잔차에 곱하는 가중치). 높이면 윤곽에 딱 붙고, 낮추면 프롬프트가 더 자유롭게 날뛴다 — '구조 충실도 vs 창의성'의 균형추.",
      },
    ],
  },

  // Part 8 — IP-Adapter (image prompt, decoupled cross-attention, face adapter)
  8: {
    primarySource: {
      title: "IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models",
      url: "https://arxiv.org/abs/2308.06721",
      why: "참조 이미지를 '분리된(decoupled) cross-attention'으로 주입해 별도 학습 없이 스타일을 옮기는 이 파트의 원전이야.",
    },
    recall: [
      {
        q: "IP-Adapter는 텍스트와 이미지 조건을 어떻게 따로 처리하지? 왜 'decoupled' 인가?",
        a: "텍스트는 기존 텍스트 cross-attention으로, 참조 이미지는 새로 추가한 별도의 이미지 cross-attention으로 각각 처리한 뒤 합산한다. 두 경로가 분리돼 있어 decoupled라 부른다.",
        hint: "한 attention에 섞지 않고, 이미지용을 따로 붙여.",
      },
      {
        q: "IP-Adapter 파일이 ~100MB로 작은 이유는? 무엇만 학습돼 있나?",
        a: "UNet 본체는 그대로 두고, '이미지 임베딩 → cross-attention'으로 보내는 투영 가중치(to_k/to_v)만 새로 학습했기 때문이다.",
      },
      {
        q: "특정 인물 얼굴을 마스크 영역에 정확히 심으려면 어떤 변형을 쓰지? scale은 무엇을 조절하나?",
        a: "얼굴에 특화 학습된 full-face IP-Adapter를 쓴다. ip_adapter_scale은 참조 이미지를 얼마나 강하게 따를지(이미지 충실도)를 조절한다.",
      },
    ],
  },

  // Part 9 — LoRA Fine-tuning (low-rank adaptation, PEFT, textual inversion)
  9: {
    primarySource: {
      title: "LoRA: Low-Rank Adaptation of Large Language Models (Hu et al. 2021)",
      url: "https://arxiv.org/abs/2106.09685",
      why: "원본 가중치는 얼린 채 저랭크 행렬 A·B만 학습하는 LoRA의 원전이야 — SD에 싸게 새 개념을 가르치는 토대.",
    },
    recall: [
      {
        q: "LoRA는 원본 가중치 W를 직접 바꾸나? 출력이 어떻게 계산되지?",
        a: "원본 W는 얼린 채 그대로 둔다. 옆에 저랭크 행렬 A·B만 학습해 더하므로 출력 = Wx + scale·(B·A)x. 학습되는 건 A·B뿐이라 파일이 가볍다.",
        hint: "W는 안 건드려. 작은 보정 행렬만 더해.",
      },
      {
        q: "cross_attention_kwargs의 scale(LoRA scale)은 무엇을 조절하지? 0 / 1.0 / 1.4는 각각?",
        a: "LoRA를 얼마나 세게 적용할지의 다이얼. scale=0이면 순수 베이스 모델, 1.0이면 학습한 그대로, 1.4면 과하게 밀어붙인 상태(보통 0.6~1.0이 자연스러움).",
        hint: "켜고 끄는 스위치가 아니라 세기 조절기.",
      },
      {
        q: "이 파트의 negative embedding(textual inversion)은 LoRA와 뭐가 다르지?",
        a: "LoRA처럼 가중치를 고치는 게 아니라, '망친 그림(찌그러진 손·저화질 등)'만 학습한 새 텍스트 토큰을 CLIP 임베딩에 등록한다. negative_prompt에 그 토큰 이름만 적으면 긴 부정 프롬프트를 한 단어로 대신한다.",
      },
    ],
  },

  // Part 10 — Inference Optimization (LCM distillation, quantization)
  10: {
    primarySource: {
      title: "Latent Consistency Models: Synthesizing High-Resolution Images with Few-Step Inference",
      url: "https://arxiv.org/abs/2310.04378",
      why: "수십 스텝을 2~4스텝으로 줄이는 LCM 증류의 원전이야 — 이 파트의 속도 최적화 절반이 여기서 나와.",
    },
    recall: [
      {
        q: "LCM은 왜 2~4스텝이면 충분하지? 보통 DDPM/DDIM과 뭐가 다른가?",
        a: "노이즈를 찔끔찔끔 여러 번 걷어내는 대신, '노이즈 낀 상태에서 곧장 깨끗한 결과로 점프'하도록 증류(distill)됐기 때문이다. 그래서 보통 20~30스텝이 필요한 DDIM과 달리 2~4스텝으로 끝난다.",
        hint: "여러 번 깎기 vs 한 번에 점프.",
      },
      {
        q: "LCM으로 생성할 때 guidance_scale은 어떻게 둬야 하지? 평범한 SD와 정반대인 점은?",
        a: "LCM에선 guidance_scale=0으로 CFG를 꺼야 한다(켜면 오히려 결과가 깨진다). 보통 SD가 7.5쯤 주는 것과 정반대다.",
      },
      {
        q: "4비트 양자화로 VRAM을 줄일 때, 모델의 어느 부분을 압축하고 어디는 그냥 두지? 계산은 어떤 정밀도로 하나?",
        a: "제일 무거운 U-Net의 선형층만 4비트(nf4)로 압축하고, 작은 VAE·텍스트 인코더는 fp16 그대로 둔다. 저장은 4비트지만 추론 때 그 층만 fp16으로 역양자화해 계산해 정확도를 지킨다.",
        hint: "다 누르는 게 아니라 무거운 선형층만. 계산은 풀어서.",
      },
    ],
  },
};
