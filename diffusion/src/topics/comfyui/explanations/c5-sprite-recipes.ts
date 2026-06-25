import type { ExplanationEntry } from "./types";

// 코드 셀 4개에 1:1 대응 — [0] PixelSnap, [1] ColorQuantize, [2] SpriteMask, [3] SpritePartLoader.

const explanations: ExplanationEntry[] = [
  // 0 — PixelSnap (순수 numpy/PIL, 전/후)
  {
    text: "픽셀퍼펙트로 스냅하는 순수 파이썬 노드야. 먼저 헬퍼 둘 — _to_pil은 ComfyUI IMAGE([B,H,W,C] float 0..1)의 첫 장을 ×255 uint8 PIL로, _to_tensor는 거꾸로 ÷255 텐서로 되돌려. 스냅 트릭은 단순해: 원본을 grid×grid(예 64×64)로 Image.NEAREST로 줄였다가 같은 크기로 다시 NEAREST로 키워. antialias가 없는 nearest라 각 격자 칸이 단일 색으로 뭉쳐 계단 픽셀이 또렷해지지. 학습용으로 원본(before)과 스냅(after)을 둘 다 반환해 나란히 비교해.",
    imports: [
      {
        name: "numpy (as np)",
        what: "배열 연산 라이브러리",
        use: "텐서↔PIL 변환에서 *255/÷255, uint8 캐스팅에 사용",
      },
      {
        name: "torch",
        what: "PyTorch — ComfyUI 텐서 타입",
        use: "from_numpy로 [1,H,W,C] IMAGE 텐서 복원",
      },
      {
        name: "PIL.Image",
        what: "Pillow 이미지 — resize/quantize 등 픽셀 연산",
        use: "resize(..., Image.NEAREST)로 다운→업스케일해 픽셀 격자에 스냅",
      },
    ],
    diagram: {
      title: "픽셀 스냅 — nearest 다운→업",
      kind: "algorithm",
      summary: `flowchart LR
  IMG["원본 IMAGE<br/>[B,H,W,C]"] --> P["_to_pil (×255 uint8)"]
  P --> D["resize → grid×grid<br/>Image.NEAREST (다운)"]
  D --> U["resize → 원래 크기<br/>Image.NEAREST (업)"]
  U --> T["_to_tensor (÷255)"]
  IMG --> B["before (그대로)"]
  T --> A["after (스냅)"]`,
    },
    lines: {
      8: "IMAGE 첫 장을 ×255 uint8로 변환해 PIL로 — ComfyUI는 0..1 float, PIL은 0..255라 다리를 놔줌.",
      36: "NEAREST로 grid 크기까지 다운스케일 — antialias 없이 색을 뭉쳐 픽셀 격자를 만듦.",
      37: "다시 NEAREST로 원래 크기까지 업 — 각 칸이 단색 블록이 되어 또렷한 픽셀아트.",
      38: "before(원본)와 after(스냅) 둘 다 반환 → UI에서 전/후 비교.",
    },
  },
  // 1 — ColorQuantize (팔레트 + 커스텀 PALETTE 타입)
  {
    text: "색 수를 줄여 픽셀아트답게 만드는 노드야. PIL의 quantize가 median-cut(색 공간을 반복해 둘로 쪼개 대표색 N개를 뽑는 고전 알고리즘)을 바로 해줘 — colors=16이면 16색으로. 핵심은 출력이 둘이라는 것: 양자화 이미지(IMAGE)와, 뽑힌 팔레트를 커스텀 'PALETTE' 타입으로 따로 내. 타입은 그냥 문자열 약속(Part 1)이라 새로 만들어도 ComfyUI가 같은 PALETTE끼리만 잇게 해줘. 팔레트는 밝기순으로 정렬해 둬서, 나중에 '같은 자리 색만 교체'(스타일 유지·색만 변경)할 때 매핑이 흔들리지 않게 했어.",
    imports: [
      {
        name: "numpy (as np)",
        what: "배열 연산 라이브러리",
        use: "getpalette() 결과를 N×3로 reshape하고 밝기 합으로 argsort 정렬",
      },
      {
        name: "PIL.Image",
        what: "Pillow 이미지 — quantize 내장",
        use: "quantize(method=Image.MEDIANCUT)로 median-cut 팔레트화",
      },
    ],
    diagram: {
      title: "색상 양자화 — median-cut + PALETTE 출력",
      kind: "algorithm",
      summary: `flowchart TD
  IMG["IMAGE"] --> Q["quantize(colors=N, MEDIANCUT)"]
  Q --> RGB["RGB 복원 → IMAGE 출력"]
  Q --> PAL["getpalette() → N×3"]
  PAL --> SORT["밝기순 argsort 정렬"]
  SORT --> OUT["PALETTE (커스텀 타입) 출력"]`,
    },
    lines: {
      24: "median-cut으로 colors개 대표색 추출 — PIL 내장이라 한 줄. 색 수를 N으로 강제.",
      28: "getpalette()에서 앞 N×3개(0..255)만 잘라 N×3 배열로 — 실제 쓰인 팔레트.",
      29: "RGB 합(대략 밝기)으로 argsort → 색 순서를 안정화. '같은 위치 색 교체'의 기반.",
      32: "양자화 IMAGE와 정렬된 PALETTE를 함께 반환 — 다음 노드가 색표를 재사용.",
    },
  },
  // 2 — SpriteMask (SAM3 + 페인팅, 두 경로)
  {
    text: "부위 마스크를 만드는 노드로, 두 경로를 한 클래스에 묶었어. mode가 'painting'이면 Part 2의 addDOMWidget 캔버스가 hidden으로 보낸 base64 PNG를 디코드해서, RGBA의 알파 채널을 그대로 MASK로 써 — 손으로 칠한 영역이 곧 마스크지. mode가 'sam3'이면 SAM3 모델 핸들에 위임해. SAM3는 2025 신모델이라 특정 API를 가정하지 않고 predict(image, prompt) 한 번으로 추상화했어(기존 SAM 노드들과 같은 패턴). 어느 쪽이든 마지막엔 ComfyUI MASK 규약 [1,H,W] float 0..1로 맞춰 clamp해서 반환해.",
    imports: [
      {
        name: "base64",
        what: "base64 인코딩/디코딩 표준 모듈",
        use: "캔버스가 보낸 data URL의 base64 PNG를 바이트로 디코드",
      },
      {
        name: "io",
        what: "인메모리 바이트 스트림",
        use: "디코드한 PNG 바이트를 BytesIO로 감싸 PIL.Image.open에 전달",
      },
      {
        name: "numpy (as np)",
        what: "배열 연산",
        use: "RGBA에서 알파 채널을 뽑아 float 마스크로 변환",
      },
      {
        name: "torch",
        what: "PyTorch — MASK 텐서 타입",
        use: "from_numpy로 [1,H,W] MASK 텐서 생성",
      },
      {
        name: "PIL.Image",
        what: "Pillow 이미지",
        use: "base64 PNG를 RGBA로 열어 알파를 마스크로",
      },
    ],
    diagram: {
      title: "두 경로로 MASK 만들기",
      kind: "architecture",
      summary: `flowchart TD
  N["SpriteMask.make_mask"] --> M{"mode ?"}
  M -->|"painting"| C["base64 PNG 디코드<br/>RGBA 알파 → MASK"]
  M -->|"sam3"| S["sam3_model.predict(image, prompt)<br/>(2025 신모델 · 일반 래핑)"]
  C --> OUT["MASK [1,H,W] clamp(0..1)"]
  S --> OUT`,
    },
    lines: {
      28: "painting 모드 + 캔버스 데이터가 있으면 손으로 칠한 영역을 마스크로 분기.",
      31: "RGBA의 알파 채널(투명도)을 ÷255해 0..1 마스크로 — 칠한 곳이 1.",
      35: "SAM3는 모델 핸들에 위임(predict). 신모델이라 특정 API 가정 없이 추상화.",
      36: "예측 마스크를 float [1,H,W]로 — ComfyUI MASK 규약에 맞춤.",
    },
  },
  // 3 — SpritePartLoader (OUTPUT_IS_LIST → N번 실행)
  {
    text: "여러 부위를 같은 프롬프트로 한 번에 돌리는 조립 노드야. 핵심은 OUTPUT_IS_LIST=(True, True) 한 줄 — 두 출력을 '리스트'로 표시하면 ComfyUI가 다운스트림(KSampler 등)을 리스트 길이 N만큼 자동 반복 실행해(Part 3). split()은 마스크 배치 [N,H,W]를 부위별 [1,H,W] N개로 펼치고, 같은 참조 이미지를 N번 복제해 짝지어. 그러면 KSampler가 같은 프롬프트·다른 마스크로 N번 i2i를 도는 거지. 무거우면 한 바퀴마다 Part 4 cleanup_vram()을 끼워.",
    diagram: {
      title: "리스트 출력 → 다운스트림 N번 실행",
      kind: "algorithm",
      summary: `flowchart LR
  M["masks [N,H,W]"] --> SP["split: 부위별 [1,H,W] ×N"]
  IMG["참조 image"] --> SP
  SP --> L["(image 리스트, mask 리스트)<br/>OUTPUT_IS_LIST=(True,True)"]
  L --> K["KSampler — 같은 프롬프트로 N번 i2i"]
  K --> A["부위별 결과 N장 → 시트 조립"]`,
    },
    lines: {
      13: "OUTPUT_IS_LIST=(True,True): 두 출력을 리스트로 선언 → 다운스트림이 N번 자동 실행(Part 3).",
      19: "마스크 배치의 N(부위 수)을 읽어 반복 횟수로 삼음.",
      21: "[N,H,W]를 부위별 [1,H,W] N개로 슬라이스 — 각 큐가 한 부위씩 처리.",
      22: "이미지·마스크 리스트를 반환 → KSampler가 같은 프롬프트로 N번 i2i.",
    },
  },
];

export default explanations;
