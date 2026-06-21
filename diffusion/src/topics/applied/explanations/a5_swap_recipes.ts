import type { ExplanationEntry } from "./types";

// a5-swap-recipes: 코드 셀 4개 -> 설명 4개.
// 셀 순서: (0) VAE 교체, (1) 가속 LoRA + ControlNet, (2) 가속 LoRA + IP-Adapter, (3) from_pipe 변형.

const explanations: ExplanationEntry[] = [
  // 0 — VAE swap (fp16-fix)
  {
    text: "제일 흔한 실전 버그부터 잡자. SDXL 기본 VAE는 fp16에서 숫자가 넘쳐 검정/NaN 그림을 뱉는 고질병이 있어. 해결은 부품 교체 한 방 — fp16에서 안 터지게 재학습한 madebyollin/sdxl-vae-fp16-fix를 AutoencoderKL로 불러서 vae=로 끼워. VAE는 '잠재 ↔ 픽셀'을 오가는 디코더 부품이라, 가중치만 바꿔도 그림 내용은 그대로고 디코딩만 안정돼. SDXL을 fp16으로 돌릴 거면 사실상 필수 레시피야.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "repo만 주면 맞는 text2img 파이프라인을 자동 선택",
        use: "vae=로 교체 VAE를 주입해 조립",
      },
      {
        name: "AutoencoderKL",
        what: "SD/SDXL의 VAE(잠재↔픽셀 변환) 모델 클래스",
        use: "from_pretrained로 fp16-fix VAE를 불러 vae= 인자로 끼움",
      },
    ],
    lines: {
      5: "AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix'): fp16에서 안 터지게 재학습된 VAE를 부품으로 로드.",
      12: "vae=vae: 파이프라인 조립 시 기본 VAE 대신 fp16-fix VAE를 주입. 디코딩만 안정, 그림 내용은 그대로.",
    },
  },
  // 1 — accel LoRA + ControlNet
  {
    text: "이게 진짜 실전 조합이야 — 제어(ControlNet) + 가속(LCM-LoRA)을 한 파이프라인에. 순서를 따라가 봐. (1) canny 엣지로 구도를 고정하는 ControlNet과 fp16-fix VAE를 부품으로 넣어 파이프라인을 조립하고, (2) 그 위에 LCM-LoRA를 얹고 스케줄러를 LCMScheduler로 바꿔 — 가속이 켜져. (3) 추론은 4스텝 + 낮은 guidance에, controlnet_conditioning_scale로 '구도를 얼마나 강하게 따를지'를 조절(0.5 권장). 가속과 제어가 같은 부품 슬롯에 공존하니까, 4스텝으로도 원하는 구도가 잡히는 거지.",
    imports: [
      {
        name: "StableDiffusionXLControlNetPipeline",
        what: "ControlNet을 끼운 SDXL text2img 파이프라인",
        use: "controlnet=·vae=로 부품을 끼워 조립하고 LoRA를 얹음",
      },
      {
        name: "ControlNetModel",
        what: "구도/엣지 등 조건을 주입하는 제어 부품",
        use: "canny-sdxl 가중치를 불러 controlnet=로 끼움",
      },
      {
        name: "AutoencoderKL",
        what: "VAE 모델 — 여기선 fp16-fix 버전",
        use: "vae=로 끼워 fp16 안정성 확보",
      },
      {
        name: "LCMScheduler",
        what: "LCM 전용 소수 스텝 스케줄러",
        use: "from_config로 끼워 4스텝 가속을 켬",
      },
      {
        name: "load_image",
        what: "URL/경로에서 PIL 이미지를 읽는 유틸",
        use: "ControlNet에 넣을 canny 조건 이미지를 로드",
      },
    ],
    lines: {
      15: "controlnet=·vae=: 제어 부품과 안정 VAE를 같은 파이프라인 슬롯에 동시에 끼움.",
      19: "load_lora_weights: 그 위에 가속 LoRA(LCM)를 얹음 — 제어와 가속이 공존.",
      20: "LCMScheduler.from_config: 스케줄러를 LCM으로 바꿔 4스텝 가속 활성화.",
      28: "guidance_scale=1.5: 증류 모델이라 guidance 낮게.",
      29: "controlnet_conditioning_scale=0.5: 구도를 얼마나 강하게 따를지(권장 0.5).",
    },
  },
  // 2 — accel LoRA + IP-Adapter (multi-LoRA)
  {
    text: "부품 교체는 LoRA를 여러 개 동시에도 된다는 걸 보여줘. (1) 가속 LoRA와 스타일 LoRA를 각각 이름(adapter_name) 붙여 얹고, set_adapters로 가중치를 섞어 둘 다 켜 — lcm은 1.0, papercut 스타일은 0.8 같은 식. (2) 거기에 IP-Adapter를 load_ip_adapter로 얹고 set_ip_adapter_scale로 참조 이미지의 영향력을 조절(0.6). 그러면 텍스트 프롬프트 + 참조 이미지 + 가속을 한 번에 쓰는 풀 조합이 돼. 주의: 파이프라인 레벨 set_adapters는 키워드가 adapter_weights야(모델 레벨 pipe.unet.set_adapters는 weights).",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "맞는 text2img 파이프라인을 자동 선택",
        use: "여러 LoRA와 IP-Adapter를 얹는 베이스",
      },
      {
        name: "LCMScheduler",
        what: "LCM 전용 소수 스텝 스케줄러",
        use: "from_config로 끼워 가속을 켬",
      },
      {
        name: "load_image",
        what: "URL/경로에서 PIL 이미지를 읽는 유틸",
        use: "IP-Adapter에 넣을 참조 이미지를 로드",
      },
    ],
    lines: {
      11: "adapter_name='lcm': 가속 LoRA에 이름을 붙여 얹음 — 나중에 set_adapters로 지목하려고.",
      12: "adapter_name='paper': 스타일 LoRA도 이름 붙여 얹음 — 두 번째 어댑터.",
      13: "set_adapters([...], adapter_weights=[1.0, 0.8]): 두 LoRA를 가중치 섞어 동시 활성화(파이프라인 레벨 키워드는 adapter_weights).",
      17: "load_ip_adapter: 참조 이미지로 스타일/구도를 전달하는 IP-Adapter를 얹음.",
      18: "set_ip_adapter_scale(0.6): 참조 이미지의 영향력을 조절(0=무시, 1=강함).",
    },
  },
  // 3 — from_pipe morph
  {
    text: "마지막은 메모리 절약 레시피야. 이미 SDXL을 GPU에 올려놨는데 ControlNet 버전이 필요해졌어 — 다시 from_pretrained 하면 똑같은 vae·unet·text_encoder를 또 메모리에 복제해 낭비지. from_pipe는 이미 로드된 파이프라인의 부품을 그대로 재사용해 다른 태스크 파이프라인을 만들어 — 추가 메모리 0. 새로 필요한 부품(controlnet)만 인자로 끼워 주면 돼. 결과적으로 pipe와 pipe_cn은 같은 텐서를 공유해(복제 안 함). 반대로 controlnet=None을 주면 도로 일반 버전으로 변형할 수도 있어.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "맞는 text2img 파이프라인을 자동 선택 + from_pipe 제공",
        use: "from_pipe(pipe, controlnet=...)로 부품 재사용 변형",
      },
      {
        name: "ControlNetModel",
        what: "구도/엣지 제어 부품",
        use: "from_pipe에 새로 끼울 단 하나의 추가 부품",
      },
    ],
    lines: {
      14: "from_pipe(pipe, controlnet=controlnet): 기존 파이프라인의 부품(unet·vae·text_encoder…)을 재사용하고 controlnet만 추가 — 메모리 복제 없음.",
    },
  },
];

export default explanations;
