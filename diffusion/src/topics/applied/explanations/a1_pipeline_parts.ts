import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — 부품을 속성으로 꺼내본다
  {
    text: "파이프라인을 하나 불러온 다음, 부품을 점 찍어 꺼내 봐. pipe.unet · pipe.vae · pipe.scheduler 전부 그냥 속성이야 — 각자 독립된 nn.Module / 설정 객체라서 타입이고 설정이고 바로 찍힌다. 마지막의 pipe.components는 부품 전체를 dict로 돌려주는데, 이게 Part 1의 핵심 열쇠야: 재조립할 때 이걸 통째로 넘기거든.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·반정밀도(fp16)",
        use: "torch_dtype=torch.float16 지정과 .to('cuda')에만 가볍게 쓰여",
      },
      {
        name: "StableDiffusionPipeline",
        what: "SD1.x 부품(vae·text_encoder·unet·scheduler…)을 묶은 파이프라인",
        use: "from_pretrained로 올린 뒤 .unet/.vae/.components로 부품을 들여다봄",
      },
    ],
    lines: {
      11: "pipe.scheduler: 이 repo의 기본 스케줄러는 PNDM — Part 2에서 이걸 갈아끼운다.",
      16: "pipe.components: 부품 전체를 dict로 반환. 이 한 줄이 다음 셀의 재조립(**components)으로 이어지는 열쇠.",
    },
  },
  // 1 — 생성자 재조립으로 일부만 갈아끼운다
  {
    text: "부품이 dict로 나오니까, **로 풀어서 다른 파이프라인 생성자에 그대로 부어. 그러면 같은 가중치를 두 번 로드하지 않고 — 메모리에 있던 객체를 공유하면서 — img2img 같은 다른 태스크 파이프라인이 만들어져. 부품 하나만 바꾸고 싶으면? components dict를 받아 그 키만 덮어쓰고 다시 생성자에 넣으면 그 자리만 교체돼. 나머지는 그대로 재사용.",
    imports: [
      {
        name: "StableDiffusionImg2ImgPipeline",
        what: "같은 부품을 쓰되 입력 이미지를 받는 img2img 파이프라인",
        use: "**pipe.components를 넘겨 추가 메모리 없이 재조립하는 대상",
      },
      {
        name: "AutoencoderKL",
        what: "SD의 VAE(잠재 ↔ 픽셀 디코더) 클래스",
        use: "더 나은 VAE를 따로 로드해 components의 'vae' 키만 교체",
      },
    ],
    diagram: {
      title: "부품 재조립 — components dict 로 갈아끼우기",
      kind: "algorithm",
      summary: `flowchart LR
  P["pipe.components (부품 dict)"] --> U["**components 로 풀기"]
  U --> NEW["새 파이프라인 생성자에 주입"]
  NEW --> R["같은 가중치 공유 (메모리 추가 0)"]`,
      detail: `flowchart TD
  C["pipe.components"] --> A["그대로 풀기: Img2Img(**components)"]
  C --> B["dict 복사 후 한 키만 교체"]
  B --> V["parts['vae'] = better_vae"]
  V --> N["StableDiffusionPipeline(**parts)"]
  A --> OUT["부품 공유 — 추가 메모리 0"]
  N --> OUT2["vae 만 새것, 나머지는 재사용"]`,
    },
    lines: {
      5: "**pipe.components: 부품 dict를 풀어 생성자에 부어 → 같은 가중치로 img2img 재조립. 추가 메모리 0.",
      14: "parts['vae'] = better_vae: 복사한 dict에서 vae 키만 덮어써 → 다음 줄 재조립 때 그 자리만 교체.",
    },
  },
  // 2 — from_pipe: 부품 재사용으로 태스크 전환
  {
    text: "재조립을 한 줄로 해주는 게 from_pipe야. 이미 로드된 파이프라인을 통째로 넘기면, 클래스 이름을 패턴 매칭해서 대응하는 태스크 파이프라인(여기선 img2img)을 골라주고 부품을 전부 재사용해. **components를 손으로 푸는 것과 결과는 같은데, 어떤 클래스로 갈지 자동으로 정해준다는 게 차이야. text2img ↔ img2img ↔ inpaint를 메모리 추가 없이 오갈 때 쓴다.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "repo→text2img 구체 클래스를 자동 선택하는 파이프라인",
        use: "from_pretrained로 t2i를 올려 from_pipe의 출발점으로 삼음",
      },
      {
        name: "AutoPipelineForImage2Image",
        what: "대응하는 img2img 클래스를 자동 선택하는 파이프라인",
        use: "from_pipe(pipe_t2i)로 부품 재사용해 i2i 버전으로 전환",
      },
    ],
    lines: {
      10: "from_pipe(pipe_t2i): t2i의 부품을 재사용해 같은 모델의 img2img 버전으로 전환 — 가중치 재로딩 0.",
    },
  },
  // 3 — AutoPipeline: repo만 주면 클래스 자동 선택
  {
    text: "가장 높은 추상화야. 어떤 구체 클래스(SD냐 SDXL이냐 Kandinsky냐)를 써야 하는지 외울 필요 없이, AutoPipelineForText2Image에 repo id만 주면 체크포인트를 보고 맞는 파이프라인 클래스로 해석해줘. 부품 묶음을 '태스크 단위'로 다루는 거지 — 여기선 SDXL repo라 StableDiffusionXLPipeline으로 풀려.",
    imports: [
      {
        name: "AutoPipelineForText2Image",
        what: "repo id만으로 맞는 t2i 파이프라인 클래스를 자동 선택",
        use: "SDXL repo를 주면 StableDiffusionXLPipeline으로 해석해 인스턴스 반환",
      },
      {
        name: "torch",
        what: "PyTorch — fp16 dtype 지정용",
        use: "torch_dtype=torch.float16 에만 쓰여",
      },
    ],
    lines: {
      11: "__class__.__name__: Auto가 SDXL repo를 보고 StableDiffusionXLPipeline으로 자동 해석했음을 확인.",
    },
  },
];

export default explanations;
