import type { StudyDoc } from "@/models/study";

// 사실 근거: comfyui-custom-node-guide.md §5 (스프라이트 워크플로 레시피) + §1~§3.
// 검증: IMAGE 텐서=[B,H,W,C] float 0..1, MASK=[B,H,W] float 0..1 (ComfyUI 규약),
//       "PALETTE" 커스텀 타입(타입은 문자열 약속), OUTPUT_IS_LIST=(True,) N번 실행.
// 레퍼런스: SAM3→Impact Pack·comfyui_segment_anything, 페인팅→LayerForge·AlekPet PainterNode.

const doc: StudyDoc = {
  id: "c5-sprite-recipes",
  title: "스프라이트 응용 레시피",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 배운 부품을 묶어 진짜 목표로\n앞 파트에서 익힌 UI(Part 2)·실행(Part 3)·자원(Part 4) 노드를 조립해서 진짜 목표 — **스프라이트 시트 작업**을 만든다. 새로 발명할 건 거의 없어. ComfyUI엔 이미 메커니즘이 다 있고, 우린 \"어느 훅을 쓰느냐\"만 고르면 돼.\n\n전체 흐름은 한 줄: **참조 스프라이트 → 부위 마스크 → 낮은 denoise i2i(스타일 유지) → 색상 양자화 → 픽셀 스냅.** 각 단계가 노드 하나야.",
    },
    {
      type: "markdown",
      source:
        "## 개념 — 노드별 레시피 표 (메커니즘 + 베껴올 곳)\n| 만들 노드 | 메커니즘 (백엔드 / 프론트) | 출력 | 베껴올 레퍼런스 |\n|---|---|---|---|\n| **SAM3 마스킹** | SAM3 모델 로드 → 부위 세그먼트 예측 → 마스크 텐서로 | `MASK` | Impact Pack, comfyui_segment_anything |\n| **페인팅 + 마스크** | `addDOMWidget`로 `<canvas>` → 그린 영역을 base64로 hidden STRING 전송 → 디코드 | `MASK` | LayerForge, AlekPet PainterNode |\n| **픽셀 스냅** | 순수 numpy/PIL: nearest 다운→업 + 그리드 정렬 (전/후 2출력) | `IMAGE` ×2 | — (순수 파이썬) |\n| **색상 양자화** | numpy/PIL: median-cut 또는 k-means 팔레트화 | `IMAGE` + `PALETTE` | — (순수 파이썬) |\n| **리스트 i2i 조립** | 로더가 `OUTPUT_IS_LIST=(True,)` → KSampler가 N번 자동 실행 | `IMAGE` 리스트 | outputlists-combiner |\n\n> 타입은 그냥 **문자열 약속**이라 `\"PALETTE\"` 같은 새 타입을 만들어 같은 타입끼리만 잇게 할 수 있어(Part 1).\n> **스타일 유지한 채 색만 변경** = 낮은 denoise i2i(원형 유지) + 색상 양자화의 조합. SAM3는 2025 신모델이라 특정 API에 의존 말고 \"모델 로드→마스크 예측\"으로 **일반적으로 래핑**한다.",
    },
    {
      type: "markdown",
      source:
        "## 코드 — 픽셀 스냅 노드 (순수 numpy/PIL, 전/후)\n생성 결과는 가장자리가 흐릿해서 '픽셀퍼펙트'가 아니야. 트릭은 간단해: 큰 이미지를 목표 격자 크기(예 64×64)로 **nearest로 줄였다가**(antialias 끈 채) 다시 **nearest로 키워** — 그러면 각 셀이 단일 색으로 뭉쳐 계단 픽셀이 또렷해져. 학습 효과를 위해 원본(before)과 스냅 결과(after) **둘 다** 출력해 나란히 비교한다.\n\nComfyUI IMAGE 텐서 규약: `[B,H,W,C]`, float 0..1. 그래서 PIL로 넘기기 전에 ×255 uint8로, 돌아올 땐 ÷255로 변환하는 헬퍼가 필요해.",
    },
    {
      type: "code",
      source: `import numpy as np
import torch
from PIL import Image


def _to_pil(img: torch.Tensor) -> Image.Image:
    # ComfyUI IMAGE = [B,H,W,C] float 0..1 → 첫 장만 PIL RGB
    arr = (img[0].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _to_tensor(pil: Image.Image) -> torch.Tensor:
    arr = np.asarray(pil.convert("RGB"), dtype=np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]      # [1,H,W,C] 로 복원


class PixelSnap:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "grid": ("INT", {"default": 64, "min": 8, "max": 512, "step": 8}),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("before", "after")
    FUNCTION = "snap"
    CATEGORY = "sprite/pixel"

    def snap(self, image, grid):
        src = _to_pil(image)
        w, h = src.size
        # nearest 로 격자 크기까지 다운 → 같은 비율로 업 = 픽셀 뭉치기
        small = src.resize((grid, grid), Image.NEAREST)
        snapped = small.resize((w, h), Image.NEAREST)
        return (image, _to_tensor(snapped))`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — 색상 양자화 노드 (팔레트 + 커스텀 PALETTE 타입)\n픽셀아트는 색 수가 적을수록 깔끔해. PIL의 `quantize`는 **median-cut**(색 공간을 반복해 둘로 쪼개 대표색 N개를 뽑는 고전 알고리즘)을 바로 제공해 — `colors=16`이면 16색 팔레트로 줄여줘. 양자화한 이미지(IMAGE)와 함께, 뽑힌 팔레트를 **커스텀 `\"PALETTE\"` 타입**으로 따로 출력해서 다음 노드가 그 색표를 재사용하게 한다(타입은 문자열 약속이라 새로 만들어도 됨).\n\n팔레트는 밝기순으로 정렬해 둬 — 나중에 '같은 위치의 색만 교체'(스타일 유지·색만 변경)할 때 매핑이 안정적이거든.",
    },
    {
      type: "code",
      source: `import numpy as np
from PIL import Image


class ColorQuantize:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "colors": ("INT", {"default": 16, "min": 2, "max": 256}),
            },
        }

    # IMAGE + 커스텀 "PALETTE" 타입(문자열 약속 → 같은 타입끼리만 연결)
    RETURN_TYPES = ("IMAGE", "PALETTE")
    RETURN_NAMES = ("quantized", "palette")
    FUNCTION = "quantize"
    CATEGORY = "sprite/color"

    def quantize(self, image, colors):
        src = _to_pil(image)
        # median-cut 으로 colors 개 대표색 추출 → 다시 RGB 로
        q = src.quantize(colors=colors, method=Image.MEDIANCUT)
        quant_rgb = q.convert("RGB")

        # 팔레트 N×3(0..255) → 밝기순 정렬해 안정적 매핑용으로 보관
        pal = np.asarray(q.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
        order = pal.astype(np.float32).sum(axis=1).argsort()   # 대략 밝기순
        palette = pal[order]

        return (_to_tensor(quant_rgb), palette)`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — SAM3 마스크 + 페인팅 마스크\n부위별로 다르게 칠하려면 **마스크**가 필요해. 두 경로가 있어. (1) **SAM3 마스킹**: SAM3는 2025 신모델이라 특정 API에 묶지 말고 \"모델 로드 → 부위 세그먼트 예측 → MASK 텐서\"로 **일반 래핑**해(기존 SAM 노드 Impact Pack·comfyui_segment_anything가 같은 패턴). (2) **페인팅 마스크**: Part 2의 `addDOMWidget` 캔버스에서 손으로 칠한 영역을 base64로 받아 디코드 → 알파를 MASK로.\n\nComfyUI MASK 규약: `[B,H,W]` float 0..1. 아래는 두 패턴을 한 노드 안에 묶은 골격이야 — 실제 SAM3 추론부는 모델 핸들에 위임(`predictor.predict(...)`)하고, 반환 마스크를 규약 텐서로만 맞춰주면 돼.",
    },
    {
      type: "code",
      source: `import base64
import io
import numpy as np
import torch
from PIL import Image


class SpriteMask:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mode": (["sam3", "painting"],),
                "part_prompt": ("STRING", {"default": "armor"}),
            },
            # 캔버스가 그린 base64 PNG 를 숨겨 보냄(Part 2 addDOMWidget)
            "hidden": {"painted_b64": "PAINTED_B64"},
            "optional": {"sam3_model": ("SAM3_MODEL",)},
        }

    RETURN_TYPES = ("MASK",)
    FUNCTION = "make_mask"
    CATEGORY = "sprite/mask"

    def make_mask(self, image, mode, part_prompt, painted_b64=None, sam3_model=None):
        h, w = image.shape[1], image.shape[2]      # IMAGE = [B,H,W,C]
        if mode == "painting" and painted_b64:
            raw = base64.b64decode(painted_b64.split(",")[-1])
            painted = Image.open(io.BytesIO(raw)).convert("RGBA")
            alpha = np.asarray(painted)[..., 3].astype(np.float32) / 255.0
            mask = torch.from_numpy(alpha)[None, ...]            # [1,H,W]
        else:
            # SAM3 = 2025 신모델 → 모델 핸들에 위임(특정 API 가정 안 함)
            pred = sam3_model.predict(image=image, prompt=part_prompt)
            mask = pred["masks"].float()                          # [1,H,W] 규약으로
        return (mask.clamp(0.0, 1.0),)`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 리스트로 여러 부위 한 번에 (OUTPUT_IS_LIST)\n부위가 머리·몸통·다리처럼 여러 개면, 마스크를 **리스트로 출력**해 다운스트림 i2i를 부위 수만큼 자동 반복시켜. `OUTPUT_IS_LIST=(True,)`를 켠 로더가 N개를 뱉으면, 뒤따르는 KSampler가 **같은 프롬프트로 N번** 도는 거야(Part 3). 무거우면 한 바퀴마다 Part 4의 `cleanup_vram()`을 끼워 메모리 터짐을 막아.\n\n결과를 합칠 땐 outputlists-combiner류로 모아 스프라이트 시트 한 장으로 조립하면 끝. 이걸로 \"참조 한 장 → 여러 부위·여러 포즈를 같은 화풍으로 일괄 생성\"이 그냥 된다.",
    },
    {
      type: "code",
      source: `class SpritePartLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "masks": ("MASK",),       # SpriteMask 들을 모은 묶음
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    OUTPUT_IS_LIST = (True, True)        # ← 두 출력 모두 리스트 = 다운스트림 N번 실행
    FUNCTION = "split"
    CATEGORY = "sprite/batch"

    def split(self, image, masks):
        # 마스크 배치 [N,H,W] 를 N개로 펼쳐 같은 이미지와 짝지음
        n = masks.shape[0]
        img_list = [image] * n                       # 같은 참조 이미지
        mask_list = [masks[i : i + 1] for i in range(n)]  # 부위별 [1,H,W]
        return (img_list, mask_list)                 # KSampler 가 N번 같은 프롬프트로 i2i`,
    },
  ],
};

export default doc;
