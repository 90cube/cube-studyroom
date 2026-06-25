import type { StudyDoc } from "@/models/study";

// 소스: comfyui-custom-node-guide.md §0~1, §3(IS_CHANGED). ComfyUI 공식 docs(server_overview) 검증.
// V1(클래식) 스키마 — 2026년에도 표준이고 호환성 최고. 처음엔 무조건 V1.

const doc: StudyDoc = {
  id: "c1-first-node",
  title: "첫 노드 & 규칙",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — 노드는 두 겹이다\nComfyUI 노드 하나는 **두 겹**으로 돼 있어. 아래층은 **계산하는 파이썬(백엔드)** — 입력을 받아 텐서/문자열을 뱉어. 위층은 **위젯을 그리는 JS(프론트, LiteGraph)** — 화면의 노드 박스·슬라이더·버튼이야.\n핵심은 이거야: **파이썬만으로도 노드는 완성된다.** 숫자·문자·콤보·이미지 같은 기본 위젯은 파이썬이 알아서 만들어줘. 버튼·캔버스 같은 커스텀 UI가 필요할 때만 JS를 더해(그건 Part 2). 그래서 첫 노드는 파이썬 클래스 하나면 끝이야.",
    },
    {
      type: "markdown",
      source:
        "## 코드 — 동작하는 최소 노드\n파이썬 클래스에 딱 4가지만 적으면 동작하는 노드가 돼: `INPUT_TYPES`(입력)·`RETURN_TYPES`(출력)·`FUNCTION`(실행 메서드 이름)·`CATEGORY`(우클릭 메뉴 위치). `INPUT_TYPES`는 `@classmethod`라서 런타임에 콤보 목록을 계산할 수도 있어. 위젯 모양(슬라이더·콤보·멀티라인)은 전부 입력 옵션으로 결정돼 — JS 없이.",
    },
    {
      type: "code",
      source: `class MyNode:
    # 입력 정의 — @classmethod 라서 런타임에 콤보 목록도 만들 수 있다
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image":    ("IMAGE",),                        # 텐서 입력(핀으로 연결)
                "strength": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0,
                                       "step": 0.01, "display": "slider"}),  # 슬라이더
                "preset":   (["기본", "픽셀아트", "셀럽"],),     # 드롭다운(콤보)
                "text":     ("STRING", {"multiline": True}),   # 여러 줄 텍스트박스
            },
            "optional": {"mask": ("MASK",)},                   # 연결 안 해도 됨
            "hidden":   {"unique_id": "UNIQUE_ID", "prompt": "PROMPT"},  # 숨은 메타
        }

    RETURN_TYPES = ("IMAGE", "MASK")   # 출력 타입(튜플). 1개면 ("IMAGE",) 꼭 콤마!
    RETURN_NAMES = ("결과", "마스크")    # (선택) 출력 핀에 붙는 이름
    FUNCTION = "run"                   # 아래 실행 메서드 이름
    CATEGORY = "sprite/edit"           # 우클릭 메뉴에서 노드가 뜨는 위치

    def run(self, image, strength, preset, text, mask=None, unique_id=None, prompt=None):
        # ... 실제 계산 ...
        return (image, mask)           # RETURN_TYPES 순서대로 튜플 반환`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — 캐시 제어와 커스텀 타입\nComfyUI는 입력이 안 바뀌면 노드를 **다시 안 돌리고 캐시**를 써. `IS_CHANGED`가 그걸 제어해 — 반환값이 지난번과 다르면 재실행이야. 그래서 **매번 강제 재실행**하려면 `float(\"NaN\")`을 돌려주면 돼. NaN은 자기 자신과도 같지 않거든(`NaN != NaN`), 그래서 항상 \"바뀌었다\"로 판정나.\n또 하나: **타입은 그냥 문자열 약속**이야. `\"IMAGE\"`·`\"MASK\"`도 문자열일 뿐, 그래서 `\"PALETTE\"` 같은 **새 타입을 아무 문자열로나** 만들 수 있어. 같은 문자열끼리만 연결되고, `\"*\"`는 와일드카드(아무거나 받음).",
    },
    {
      type: "code",
      source: `class PaletteSource:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"seed": ("INT", {"default": 0})}}

    RETURN_TYPES = ("PALETTE",)        # 새 커스텀 타입 — 그냥 문자열 약속
    RETURN_NAMES = ("팔레트",)
    FUNCTION = "make"
    CATEGORY = "sprite/color"

    @classmethod
    def IS_CHANGED(cls, seed):
        return float("NaN")            # NaN != NaN → 항상 "바뀜" → 매 큐마다 재실행

    def make(self, seed):
        palette = build_palette(seed)  # ... 팔레트 계산 ...
        return (palette,)              # "PALETTE" 타입으로 출력 (PALETTE 입력에만 연결됨)`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 패키징해서 ComfyUI에 등록\n노드를 ComfyUI에 보이게 하려면 `custom_nodes/내노드/` 폴더에 `__init__.py`를 두고 **매핑 딕셔너리**를 노출해. `NODE_CLASS_MAPPINGS`가 \"내부 이름 → 클래스\"를 등록하고(이게 필수), `NODE_DISPLAY_NAME_MAPPINGS`는 화면 표시 이름이야. JS 프론트가 있을 때만 `WEB_DIRECTORY`로 그 폴더를 가리켜. ComfyUI를 재시작하면 우클릭 메뉴의 `CATEGORY` 위치에 노드가 떠.",
    },
    {
      type: "code",
      source: `# custom_nodes/my_sprite_nodes/__init__.py
from .nodes import MyNode, PaletteSource

NODE_CLASS_MAPPINGS = {
    "MyNode": MyNode,                 # 내부 식별자 → 클래스 (등록의 핵심)
    "PaletteSource": PaletteSource,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "MyNode": "🎨 My Node",           # 화면에 보이는 이름
    "PaletteSource": "🎨 Palette Source",
}
WEB_DIRECTORY = "./js"               # 프론트 JS 폴더 — JS 확장이 있을 때만

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]`,
    },
  ],
};

export default doc;
