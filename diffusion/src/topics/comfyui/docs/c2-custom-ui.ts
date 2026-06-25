import type { StudyDoc } from "@/models/study";

// 소스: comfyui-custom-node-guide.md §2(커스텀 UI 표). ComfyUI 공식 docs(javascript_overview,
// javascript_objects_and_hijacking) 검증. addWidget("button")·addDOMWidget·OUTPUT_NODE 미리보기·LiteGraph 훅.

const doc: StudyDoc = {
  id: "c2-custom-ui",
  title: "노드 안 커스텀 UI",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — JS 확장을 어디에 끼우나\n기본 위젯(숫자·콤보·슬라이더)으로 부족하면 **JS 확장**으로 버튼·캔버스·미리보기를 노드에 박아. 진입점은 `app.registerExtension` 하나야. 그 안의 **`beforeRegisterNodeDef` 훅**이 노드 정의가 등록되기 직전에 불려서, 거기서 노드 클래스의 메서드를 가로채(hijack) 내 코드를 끼워넣어.\n패턴은 항상 같아: 원래 `onNodeCreated`를 보관 → 내 함수로 교체 → 안에서 원본을 먼저 부르고(`orig?.apply`) → 그다음 위젯을 추가. 원본을 안 부르면 ComfyUI 기본 동작이 깨지니까 **꼭 먼저 호출**해.\n\n> 참고: 아래 예시는 **바닐라 JS**로 보여주지만 작성 언어를 강제하는 건 아니야 — **TypeScript·React·Vue·Svelte**로 짜서 빌드(dist→JS)해도 똑같이 `WEB_DIRECTORY`로 로드돼(framework-agnostic). 바닐라 JS는 빌드 단계가 없어서 **배우기 가장 쉬워** 쓰는 거고, 복잡한 패널·캔버스는 React/Vue가 편해.",
    },
    {
      type: "markdown",
      source:
        "## 코드 — registerExtension + 버튼 위젯\n가장 쉬운 커스텀 UI는 **버튼**이야. `this.addWidget(\"button\", \"라벨\", null, 콜백)` 한 줄이면 노드에 버튼이 생기고, 누르면 콜백이 돌아. `WEB_DIRECTORY/js/`에 둔 이 파일을 ComfyUI가 자동으로 읽어(Part 1의 `WEB_DIRECTORY`가 이걸 가리킴).",
    },
    {
      type: "code",
      source: `import { app } from "../../scripts/app.js";

app.registerExtension({
  name: "sprite.MyNode",                         // 확장 고유 이름(중복 금지)
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "MyNode") return;       // 내 노드일 때만 손댄다

    const orig = nodeType.prototype.onNodeCreated;      // 원본 보관
    nodeType.prototype.onNodeCreated = function () {
      orig?.apply(this, arguments);               // 원본 먼저 호출(안 하면 기본동작 깨짐)

      // 노드에 버튼 추가 — 누르면 콜백 실행
      this.addWidget("button", "프리셋 저장", null, () => {
        const text = this.widgets.find(w => w.name === "text")?.value;
        console.log("저장할 프롬프트:", text);
      });
    };
  },
});`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — addDOMWidget 으로 캔버스 박기\n버튼을 넘어 **임의의 HTML**(캔버스·미리보기·iframe)을 노드에 넣으려면 `node.addDOMWidget(name, type, el)`을 써. 진짜 DOM 요소를 노드 본문에 박는 공식 패턴이야(오디오/녹음 위젯도 이걸로 만들어졌어). 캔버스를 넣으면 그 안에서 그림을 그리고, 실행할 때 그 그림을 base64로 떠서 **hidden STRING**으로 서버에 보내 — 백엔드에서 디코드하면 페인팅 노드가 돼.",
    },
    {
      type: "code",
      source: `nodeType.prototype.onNodeCreated = function () {
  orig?.apply(this, arguments);

  // 1) 진짜 <canvas> DOM 요소를 만든다
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // 2) DOM 요소를 노드 본문에 박는다 (공식 패턴)
  const widget = this.addDOMWidget("paint", "canvas", canvas);

  // 3) 캔버스에 자유롭게 그린다
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 512, 512);

  // 4) 실행 시: 캔버스 → base64 → 숨은 STRING 위젯에 실어 서버로
  widget.serializeValue = () => canvas.toDataURL("image/png");
};`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — OUTPUT_NODE 이미지 미리보기 (백엔드)\n결과 이미지를 **노드 안에서 바로 보여주려면** 백엔드 쪽 일이야. 클래스에 `OUTPUT_NODE = True`를 달면 그래프 **끝단**(저장·미리보기 같은 사이드이펙트) 노드가 돼. 그리고 실행 메서드가 `return {\"ui\": {\"images\": [...]}}` 형태로 돌려주면 ComfyUI 프론트가 그 이미지를 노드 밑에 그려(코어 PreviewImage가 쓰는 바로 그 방식). 파일은 보통 임시폴더에 저장하고 `filename·subfolder·type`만 넘겨.",
    },
    {
      type: "code",
      source: `import folder_paths
from PIL import Image
import numpy as np

class PreviewSprite:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",)}}

    RETURN_TYPES = ()                  # 끝단이라 핀 출력은 없음
    FUNCTION = "preview"
    CATEGORY = "sprite/view"
    OUTPUT_NODE = True                 # 그래프 끝단(사이드이펙트) 노드로 표시

    def preview(self, images):
        out = []
        tmp = folder_paths.get_temp_directory()      # 임시 저장 폴더
        for i, img in enumerate(images):
            arr = (img.cpu().numpy() * 255).astype(np.uint8)
            name = f"sprite_{i}.png"
            Image.fromarray(arr).save(f"{tmp}/{name}")
            out.append({"filename": name, "subfolder": "", "type": "temp"})
        # ui.images 로 돌려주면 프론트가 노드 밑에 미리보기를 그린다
        return {"ui": {"images": out}}`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — LiteGraph 훅으로 직접 그리고 클릭 받기\nComfyUI 노드는 **LiteGraph의 `LGraphNode` 서브클래스**라서, LiteGraph 훅을 그대로 쓸 수 있어. `onDrawForeground(ctx)`는 매 프레임 노드 위에 직접 2D 드로잉을 해(오버레이·상태 표시등). `onMouseDown(e, pos)`는 노드 안 클릭을 받아 — `pos`는 노드 로컬 좌표라 어디를 눌렀는지 알 수 있어. 둘을 합치면 위젯 없이도 클릭 가능한 커스텀 UI(예: 색 견본 팔레트)를 그릴 수 있어.",
    },
    {
      type: "code",
      source: `// onDrawForeground: 노드 위에 매 프레임 직접 그린다
const origDraw = nodeType.prototype.onDrawForeground;
nodeType.prototype.onDrawForeground = function (ctx) {
  origDraw?.apply(this, arguments);
  if (this.flags.collapsed) return;              // 접혀 있으면 안 그림
  ctx.fillStyle = this._ready ? "#3c3" : "#c33"; // 상태 표시등
  ctx.beginPath();
  ctx.arc(this.size[0] - 14, 14, 5, 0, Math.PI * 2);
  ctx.fill();
};

// onMouseDown: 노드 안 클릭을 받는다 (pos = 노드 로컬 좌표)
const origDown = nodeType.prototype.onMouseDown;
nodeType.prototype.onMouseDown = function (e, pos, canvas) {
  if (pos[1] < 20 && pos[0] > this.size[0] - 24) {
    this._ready = !this._ready;                  // 표시등 토글
    return true;                                 // true = 이벤트 소비(전파 막음)
  }
  return origDown?.apply(this, arguments);
};`,
    },
  ],
};

export default doc;
