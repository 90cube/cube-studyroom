import type { StudyDoc } from "@/models/study";

// 소스: comfyui-custom-node-guide.md §3(실행 모델). ComfyUI 공식 docs(backend/lists) 검증.
// OUTPUT_IS_LIST / INPUT_IS_LIST / control_after_generate / lazy+check_lazy_status / ExecutionBlocker.

const doc: StudyDoc = {
  id: "c3-execution",
  title: "실행 흐름 제어",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 노드는 한 번만 도는 게 아니다\n노드 실행은 고정이 아니야. ComfyUI는 **리스트**를 만나면 다운스트림을 **항목 수만큼 자동 반복**해. 그래서 이미지 N장을 리스트로 출력하면 KSampler가 N번 돌아 — 같은 프롬프트, 다른 이미지로 i2i N개가 그냥 돼.\n이 파트는 4개의 레버를 다뤄: **리스트 출력/입력**(N번 실행), **control_after_generate**(매 큐마다 시드·인덱스 증감/랜덤), **lazy**(필요한 가지만 계산), **ExecutionBlocker**(가지 전체 끊기). 전부 ComfyUI 네이티브라 새로 발명할 게 없어.",
    },
    {
      type: "markdown",
      source:
        "## 코드 — OUTPUT_IS_LIST 로 N번 실행\n`OUTPUT_IS_LIST = (True,)`는 \"이 출력 핀은 리스트다\"라고 ComfyUI에 알려주는 플래그야(튜플이라 출력 핀마다 True/False). 이걸 켜고 리스트를 반환하면, 다운스트림 노드가 리스트의 **각 항목마다 한 번씩**, 즉 N번 자동 실행돼. 이미지 N장을 흘리면 같은 워크플로가 N장에 각각 적용 — 일괄 i2i의 핵심이야.",
    },
    {
      type: "code",
      source: `import torch

class LoadSpriteList:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"folder": ("STRING", {"default": "sprites/"})}}

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("이미지들",)
    OUTPUT_IS_LIST = (True,)            # 이 출력은 리스트 → 다운스트림이 N번 자동 실행
    FUNCTION = "load"
    CATEGORY = "sprite/io"

    def load(self, folder):
        images = read_all_pngs(folder)         # 예: 8장
        tensors = [to_tensor(im) for im in images]   # 각 (1,H,W,3)
        return (tensors,)                  # 리스트로 반환 → KSampler가 8번 i2i`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — INPUT_IS_LIST 로 리스트를 통째로 받기\n반대 방향이야. 보통은 ComfyUI가 리스트를 쪼개 항목마다 노드를 부르지만, **리스트 전체를 한 번에** 받고 싶을 때가 있어(개수 세기·이어붙이기·그리드 만들기). 그때 `INPUT_IS_LIST = True`를 켜면 실행 메서드의 인자가 \"항목\"이 아니라 \"리스트\"로 들어와 — 그래서 한 번만 실행되고 내가 직접 순회해.",
    },
    {
      type: "code",
      source: `class StackSprites:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",)}}

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("그리드",)
    INPUT_IS_LIST = True               # 인자를 항목별이 아니라 '리스트 통째'로 받는다
    FUNCTION = "stack"
    CATEGORY = "sprite/io"

    def stack(self, images):
        # images 는 텐서 리스트 전체. 노드는 딱 한 번만 실행된다.
        grid = torch.cat(images, dim=0)        # N장을 한 배치로 이어붙임
        return (grid,)`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — control_after_generate (증감/랜덤)\n매 큐마다 **시드나 인덱스를 자동으로 바꾸고** 싶을 때. ComfyUI 프론트는 **INT 위젯에 `control_after_generate` 드롭다운을 자동으로 붙여** — 값은 `fixed`(고정)·`increment`(+1)·`decrement`(−1)·`randomize`(랜덤). 큐를 실행할 때마다 이 규칙대로 그 INT가 다음 값으로 갱신돼. 시드 변주, 리스트 인덱스 순회에 그대로 써. 파이썬에선 그냥 INT 위젯을 선언하면 되고, 컨트롤은 프론트가 알아서 달아줘.",
    },
    {
      type: "code",
      source: `class PickByIndex:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                # 평범한 INT 위젯 — 프론트가 control_after_generate 드롭다운을 자동으로 붙인다
                # (fixed / increment / decrement / randomize)
                "index": ("INT", {"default": 0, "min": 0, "max": 9999}),
                "seed":  ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "pick"
    CATEGORY = "sprite/io"

    def pick(self, images, index, seed):
        n = images.shape[0]
        return (images[index % n].unsqueeze(0),)   # index가 매 큐 +1 되면 한 장씩 순회`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — lazy 입력 + check_lazy_status (필요한 가지만)\n조건부 계산의 1번 도구야. 입력에 `\"lazy\": True`를 달면 그 입력은 **요청하기 전엔 평가되지 않아**(업스트림이 안 돌아). 노드는 먼저 `check_lazy_status`로 \"지금 어떤 입력이 실제로 필요한지\"를 이름 리스트로 알려주고, ComfyUI는 그 입력들만 계산해서 다시 실행 메서드를 불러. if/else에서 안 고른 가지의 무거운 연산을 통째로 건너뛰는 거야.",
    },
    {
      type: "code",
      source: `class LazySwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "use_a": ("BOOLEAN", {"default": True}),
                "a": ("IMAGE", {"lazy": True}),    # 요청 전엔 평가 안 됨(업스트림 안 돎)
                "b": ("IMAGE", {"lazy": True}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "run"
    CATEGORY = "sprite/flow"

    def check_lazy_status(self, use_a, a, b):
        # 지금 '실제로 필요한' 입력 이름만 리스트로 알려준다 → 그 가지만 계산됨
        return ["a"] if use_a else ["b"]

    def run(self, use_a, a, b):
        return (a if use_a else b,)        # 고른 쪽만 이미 계산돼 들어와 있다`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — ExecutionBlocker 로 가지 전체 끊기\n`lazy`가 \"필요한 가지만 계산\"이라면, `ExecutionBlocker`는 \"이 가지를 **아예 막아라**\"야. 어떤 출력에 `ExecutionBlocker(None)`을 흘려보내면, 그 값을 받는 **다운스트림 전체가 실행되지 않아** — if/else 분기에서 거짓 쪽 전체를 꺼버리는 셈. 생성자에 `None`을 주면 조용히 막고, 문자열을 주면 에러 메시지를 띄워. 정상일 땐 진짜 텐서를, 막을 땐 ExecutionBlocker를 같은 핀으로 내보내면 돼. `comfy_execution.graph`에서 가져와.",
    },
    {
      type: "code",
      source: `from comfy_execution.graph import ExecutionBlocker

class GateSprite:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "enabled": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "gate"
    CATEGORY = "sprite/flow"

    def gate(self, image, enabled):
        if not enabled:
            # 이 출력을 받는 다운스트림 가지 전체가 실행 안 됨
            return (ExecutionBlocker(None),)
        return (image,)                    # 통과시키면 평소처럼 텐서를 흘려보냄`,
    },
  ],
};

export default doc;
