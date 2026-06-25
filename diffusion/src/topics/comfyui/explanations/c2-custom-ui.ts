import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — app.registerExtension + beforeRegisterNodeDef + addWidget("button")
  {
    text: "JS 확장의 진입점이야. app.registerExtension에 이름과 훅을 등록하면 ComfyUI가 자동으로 불러줘. beforeRegisterNodeDef는 노드 정의가 등록되기 직전에 호출되는데, 여기서 내 노드인지 이름으로 거르고 onNodeCreated를 가로채. 패턴이 핵심이야: 원본을 orig에 보관 → 내 함수로 교체 → 안에서 orig를 먼저 부른 뒤(이걸 빼먹으면 기본동작이 깨져) → 위젯을 추가해. 버튼은 addWidget(\"button\", 라벨, null, 콜백) 한 줄. 누르면 콜백이 돌고, this.widgets로 다른 위젯 값도 읽을 수 있어.",
    imports: [
      {
        name: "app",
        what: "ComfyUI 프론트엔드 전역 앱 객체(scripts/app.js)",
        use: "registerExtension로 확장을 등록하는 유일한 진입점",
      },
    ],
    diagram: {
      title: "확장이 노드에 끼어드는 흐름",
      kind: "architecture",
      summary: `flowchart TD
  REG["app.registerExtension"] --> BRD["beforeRegisterNodeDef(nodeType, nodeData)"]
  BRD --> CHK{"nodeData.name 이 내 노드?"}
  CHK -->|아니오| SKIP["return (안 건드림)"]
  CHK -->|예| HJ["onNodeCreated 가로채기<br/>orig 보관 → 교체"]
  HJ --> ADD["orig 먼저 호출 → addWidget('button', …)"]`,
    },
    lines: {
      6: "nodeData.name으로 내 노드일 때만 손댐 — 모든 노드에 이 훅이 불리므로 거르지 않으면 남의 노드까지 건드림.",
      8: "원본 onNodeCreated를 orig에 보관. 교체 전에 백업해 둬야 아래서 다시 부를 수 있음.",
      10: "orig?.apply(this, arguments) — 원본을 먼저 호출. 빼먹으면 ComfyUI 기본 노드 초기화가 깨짐.",
      13: "addWidget(\"button\", 라벨, null, 콜백) — 버튼 위젯 한 줄. 누르면 콜백 실행. 가장 쉬운 커스텀 UI.",
    },
  },
  // 1 — addDOMWidget(canvas) + serializeValue
  {
    text: "버튼을 넘어 임의의 HTML을 노드에 박는 법이야. document.createElement로 진짜 <canvas> DOM을 만들고, addDOMWidget(name, type, el)로 그걸 노드 본문에 꽂아 — 오디오 위젯 같은 코어 UI도 이 공식 패턴으로 만들어졌어. 캔버스를 박았으면 getContext(\"2d\")로 자유롭게 그려. 마지막 줄이 진짜 포인트야: serializeValue를 toDataURL로 덮어쓰면, 노드를 실행할 때 ComfyUI가 캔버스 그림을 base64 문자열로 떠서 자동으로 서버에 보내줘. 백엔드에서 그 STRING을 디코드하면 '그린 그림이 입력'인 페인팅 노드가 완성돼.",
    diagram: {
      title: "캔버스 → 서버 전송 경로",
      kind: "architecture",
      summary: `flowchart LR
  EL["createElement('canvas')"] --> DW["addDOMWidget('paint','canvas',el)"]
  DW --> DRAW["ctx 로 자유 드로잉"]
  DRAW --> SV["serializeValue = toDataURL()"]
  SV --> SRV["실행 시 base64 STRING 으로 서버 전송"]`,
    },
    lines: {
      11: "addDOMWidget(name, type, el) — 진짜 DOM 요소를 노드 본문에 박는 공식 패턴. 캔버스·미리보기·iframe 다 가능.",
      18: "serializeValue를 toDataURL로 덮어씀 → 실행 시 캔버스 그림이 base64로 자동 직렬화돼 서버로. 페인팅 노드의 핵심.",
    },
  },
  // 2 — OUTPUT_NODE + return {"ui":{"images":...}} (Python preview)
  {
    text: "이미지 미리보기는 백엔드 쪽 일이야. OUTPUT_NODE = True를 달면 이 노드가 그래프 끝단(저장·미리보기 같은 사이드이펙트 노드)이 돼 — 핀 출력이 없어도 실행돼. preview 함수는 텐서를 PNG로 임시폴더에 저장하고, 각 파일의 filename·subfolder·type만 모아서 return {\"ui\": {\"images\": [...]}}로 돌려줘. 그럼 프론트가 그 메타를 받아 노드 밑에 이미지를 그려 — 코어 PreviewImage가 쓰는 바로 그 방식이야. 텐서는 0~1 float이라 255 곱하고 uint8로 바꾼 뒤 PIL로 저장하는 게 정석.",
    imports: [
      {
        name: "folder_paths",
        what: "ComfyUI 경로 헬퍼(임시·출력·input 폴더 위치)",
        use: "get_temp_directory()로 미리보기 PNG를 둘 임시폴더를 얻음",
      },
      {
        name: "Image (PIL)",
        what: "Pillow 이미지 — 배열↔파일 변환",
        use: "fromarray로 numpy 배열을 PNG로 저장",
      },
      {
        name: "numpy",
        what: "수치 배열 라이브러리",
        use: "텐서를 0~255 uint8 배열로 변환(이미지 저장용)",
      },
    ],
    lines: {
      13: "OUTPUT_NODE = True — 그래프 끝단(사이드이펙트) 노드로 표시. 핀 출력이 없어도 실행 대상이 됨.",
      19: "텐서는 0~1 float → 255 곱하고 uint8로. 이미지 파일로 저장하려면 이 변환이 필수.",
      22: "filename·subfolder·type만 모음 — 프론트는 이 메타로 임시폴더의 PNG를 찾아 그림.",
      24: "return {\"ui\": {\"images\": out}} — 프론트가 노드 밑에 미리보기를 그리게 하는 반환 형식(PreviewImage 방식).",
    },
  },
  // 3 — LiteGraph hooks: onDrawForeground / onMouseDown
  {
    text: "ComfyUI 노드는 LiteGraph의 LGraphNode 서브클래스라서, LiteGraph 훅을 그대로 가로채 쓸 수 있어. onDrawForeground(ctx)는 매 프레임 노드 위에 직접 2D를 그려 — 여기선 오른쪽 위에 상태 표시등(준비됐으면 초록, 아니면 빨강)을 찍었어. collapsed면 안 그리도록 빼는 게 매너야. onMouseDown(e, pos, canvas)은 노드 안 클릭을 받는데, pos가 노드 로컬 좌표라 '어느 영역을 눌렀나'를 판정할 수 있어. 표시등 자리를 누르면 토글하고 return true로 이벤트를 소비해(전파를 막아 노드가 안 끌리게). 위젯 없이도 클릭 가능한 커스텀 UI를 만드는 법이야.",
    diagram: {
      title: "그리기 훅 + 클릭 훅",
      kind: "architecture",
      summary: `flowchart TD
  FRAME["매 프레임"] --> DF["onDrawForeground(ctx)<br/>표시등·오버레이 직접 드로잉"]
  CLICK["노드 안 클릭"] --> MD["onMouseDown(e, pos)"]
  MD --> HIT{"pos 가 표시등 영역?"}
  HIT -->|예| T["상태 토글 + return true(소비)"]
  HIT -->|아니오| P["원본 onMouseDown 으로 전달"]`,
    },
    lines: {
      5: "collapsed(접힘)면 그리기 스킵 — 접힌 노드에 오버레이를 찍으면 어색하니 빼 주는 게 정석.",
      6: "this._ready 상태에 따라 색을 바꿔 상태 표시등을 그림. ctx는 노드 좌표계의 2D 컨텍스트.",
      15: "pos는 노드 로컬 좌표 → 오른쪽 위(표시등 영역) 클릭인지 판정.",
      17: "return true = 이벤트 소비(전파 차단). 안 하면 클릭이 그래프로 새서 노드가 드래그됨.",
    },
  },
];

export default explanations;
