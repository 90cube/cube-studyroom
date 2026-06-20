import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — from_pretrained + call
  {
    text: "diffusers한테 미리 학습된 SD 가중치를 통째로 불러오라고 시켜(from_pretrained). 반정밀도(float16)로 받아 GPU에 올리고, 프롬프트 문자열을 주면 .images[0]에 결과가 나와. 이 세 줄 안에 텍스트 인코딩·denoising·디코딩이 전부 숨어 있어 — 그걸 '내부 동작' 탭에서 풀어볼 거야.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·반정밀도",
        use: "float16 dtype 지정, .to('cuda'), 시드 generator에 쓰여",
      },
      {
        name: "StableDiffusionPipeline",
        what: "텍스트인코더+U-Net+VAE+스케줄러를 한 객체로 묶은 SD 파이프라인",
        use: "from_pretrained로 불러오고 pipe(prompt)로 호출하는 이 파트의 주인공",
      },
    ],
    lines: {
      2: "StableDiffusionPipeline은 모듈이 아니라 '클래스'(코드 덩어리) — diffusers 패키지 안 pipeline_stable_diffusion.py에 class로 정의돼 있어. diffusers가 __init__.py에서 최상위로 re-export해줘서 긴 경로 없이 바로 import되는 거야.",
      4: "from_pretrained: 허브 repo id를 주면 가중치+설정을 통째로 받아 파이프라인을 조립해.",
      6: "torch_dtype=float16: 절반 정밀도로 받아 VRAM 절약+속도↑ (그래서 .to('cuda') 전에 지정).",
      7: ".to('cuda'): 다 조립된 파이프라인을 GPU로 통째로 옮겨 — 이제부터 추론은 GPU에서.",
      9: "pipe(prompt): __call__ 호출. 이 한 줄 안에 인코딩→denoising 루프→VAE 디코딩이 다 돌아 .images[0]로 나와.",
    },
  },
  // 1 — options
  "같은 pipe를 더 정교하게 불러. negative_prompt로 빼고 싶은 걸 적고, num_inference_steps로 스텝 수(품질↔속도), guidance_scale로 프롬프트를 얼마나 강하게 따를지(CFG)를 조절해. generator에 시드를 고정하면 같은 결과를 재현할 수 있어.",
  // 2 — scheduler swap
  {
    text: "파이프라인의 스케줄러만 DDIM으로 갈아끼워. 모델 가중치는 그대로 두고 '역확산을 어떻게 밟을지'만 바꾸는 거야 — 그래서 더 적은 스텝으로도 깔끔하게 나오기도 해. 왜 이렇게 자유롭게 교체되는지는 Part 2에서.",
    imports: [
      {
        name: "DDIMScheduler",
        what: "결정론적·소수 스텝 샘플러",
        use: "from_config로 기존 설정을 물려받아 pipe.scheduler에 꽂아",
      },
    ],
    lines: {
      3: "from_config(기존 config): 학습된 베타 스케줄 등 설정은 그대로 물려받고 샘플링 방식만 DDIM으로 바꿔 pipe.scheduler에 다시 꽂아.",
    },
  },
];

export default explanations;
