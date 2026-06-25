import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — minimal node class: INPUT_TYPES / RETURN_TYPES / FUNCTION / CATEGORY
  {
    text: "동작하는 노드의 최소 골격이야. INPUT_TYPES에 입력을, RETURN_TYPES에 출력을, FUNCTION에 실행 메서드 이름을, CATEGORY에 메뉴 위치를 적으면 끝. 위젯 모양은 전부 옵션이 정해 — display:\"slider\"면 슬라이더, 리스트로 주면 콤보, multiline:True면 여러 줄 텍스트박스. JS는 한 줄도 안 써. required는 꼭 연결해야 하고, optional은 안 해도 되고, hidden은 화면에 안 보이는 메타(노드 id·전체 프롬프트)를 런 함수로 받는 통로야.",
    diagram: {
      title: "4가지 속성이 노드를 만든다",
      kind: "architecture",
      summary: `flowchart TD
  IT["INPUT_TYPES<br/>required · optional · hidden"] --> N["노드 박스"]
  RT["RETURN_TYPES<br/>출력 핀(튜플)"] --> N
  FN["FUNCTION = 'run'<br/>실행 메서드 이름"] --> N
  CAT["CATEGORY<br/>우클릭 메뉴 위치"] --> N
  N --> RUN["run(...) 호출 → 튜플 반환"]`,
    },
    lines: {
      8: "FLOAT + display:\"slider\" → 슬라이더 위젯. default/min/max/step이 슬라이더 범위·간격을 정함. JS 불필요.",
      10: "값을 리스트로 주면 → 드롭다운(콤보). 항목이 곧 선택지.",
      11: "STRING + multiline:True → 여러 줄 텍스트박스. 프롬프트 입력에 흔히 씀.",
      17: "RETURN_TYPES는 튜플. 출력이 1개여도 (\"IMAGE\",)처럼 트레일링 콤마 꼭 — 안 그러면 튜플이 아니라 문자열로 새서 깨짐.",
      19: "FUNCTION은 실행할 메서드 '이름(문자열)'. 여기 적은 이름과 아래 def run이 일치해야 함.",
      24: "RETURN_TYPES 순서 그대로 튜플로 반환. (IMAGE, MASK) 선언이면 (image, mask) 순서.",
    },
  },
  // 1 — IS_CHANGED (NaN trick) + custom "PALETTE" type
  {
    text: "캐시 제어와 커스텀 타입을 한 번에 보여줘. ComfyUI는 입력이 그대로면 노드를 안 돌리고 캐시를 재활용하는데, IS_CHANGED가 그 판단을 가로채. float(\"NaN\")을 돌려주면 NaN은 자기 자신과도 안 같아서(NaN != NaN) 항상 '바뀐 걸로' 판정 → 매 큐마다 강제 재실행이야. 랜덤·시계처럼 매번 달라야 하는 노드에 써. 그리고 RETURN_TYPES의 \"PALETTE\"는 내가 방금 지어낸 타입이야 — 타입은 그냥 문자열 약속이라 아무 이름이나 새 타입이 돼. 같은 \"PALETTE\"끼리만 핀이 연결돼서, 색 팔레트 전용 배선을 만들 수 있어.",
    diagram: {
      title: "IS_CHANGED 가 캐시를 정한다",
      kind: "algorithm",
      summary: `flowchart TD
  Q["큐 실행"] --> IC["IS_CHANGED 반환값"]
  IC --> CMP{"지난번과 같나?"}
  CMP -->|같음| CACHE["캐시 재사용 (안 돌림)"]
  CMP -->|다름| RUN["노드 재실행"]
  NAN["return float('NaN')<br/>NaN != NaN"] --> CMP`,
    },
    lines: {
      5: "\"PALETTE\" — 내가 만든 새 타입. 문자열 약속일 뿐이라 가능. 같은 \"PALETTE\" 입력에만 연결됨.",
      13: "float(\"NaN\") 반환 → NaN은 자기 자신과도 같지 않음 → 항상 '바뀜' → 매 큐마다 재실행 강제.",
      17: "출력도 (\"PALETTE\",) 타입. 일반 IMAGE 핀엔 안 꽂히고 PALETTE 핀에만 — 타입이 배선을 강제.",
    },
  },
  // 2 — packaging: __init__.py mappings + WEB_DIRECTORY
  {
    text: "노드를 ComfyUI에 등록하는 패키징이야. custom_nodes/내노드/__init__.py에서 NODE_CLASS_MAPPINGS만 노출하면 ComfyUI가 그걸 읽어 노드를 잡아 — 이게 필수 핵심이야. 키는 내부 식별자(저장 파일에 박히는 안정적 이름), 값은 클래스. NODE_DISPLAY_NAME_MAPPINGS는 화면에 예쁘게 보일 이름이라 선택이야. WEB_DIRECTORY는 JS 프론트 폴더 경로인데, Part 2처럼 버튼·캔버스를 얹을 때만 필요해. 재시작하면 우클릭 메뉴 CATEGORY 자리에 노드가 떠.",
    imports: [
      {
        name: "MyNode / PaletteSource",
        what: "내가 nodes.py에 정의한 노드 클래스들",
        use: "NODE_CLASS_MAPPINGS 값으로 등록 — ComfyUI가 이 클래스로 노드를 만든다",
      },
    ],
    lines: {
      4: "NODE_CLASS_MAPPINGS — '내부 이름 → 클래스' 등록. ComfyUI가 이 딕셔너리만 보면 노드를 잡음. 필수.",
      8: "NODE_DISPLAY_NAME_MAPPINGS — 화면 표시 이름(선택). 없으면 내부 이름이 그대로 뜸.",
      12: "WEB_DIRECTORY — 프론트 JS 폴더. 버튼·캔버스 등 JS 확장이 있을 때만 가리킴(Part 2).",
    },
  },
];

export default explanations;
