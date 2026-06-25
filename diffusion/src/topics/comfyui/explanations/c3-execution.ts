import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — OUTPUT_IS_LIST = (True,) → N runs
  {
    text: "리스트 출력으로 다운스트림을 N번 돌리는 노드야. OUTPUT_IS_LIST = (True,)는 '이 출력 핀은 리스트다'라는 플래그인데, 튜플인 이유는 출력 핀마다 따로 켜고 끄려는 거야(핀이 여럿이면 (True, False)처럼). 이걸 켜고 텐서 리스트를 반환하면 ComfyUI가 항목마다 한 번씩 다운스트림을 자동 실행해 — 8장이면 KSampler가 8번. 같은 프롬프트로 여러 이미지를 i2i 하는 일괄 처리가 이 한 줄로 돼. 핵심은 '내가 루프를 안 짠다'는 거야. 리스트만 내보내면 ComfyUI가 알아서 반복해.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 이미지 텐서 표현",
        use: "PNG들을 (1,H,W,3) 텐서로 바꿔 리스트에 담는 데만 가볍게 쓰임",
      },
    ],
    diagram: {
      title: "리스트 출력 → 자동 N번 실행",
      kind: "algorithm",
      summary: `flowchart LR
  L["LoadSpriteList<br/>OUTPUT_IS_LIST=(True,)"] -->|"이미지 8장 리스트"| K["KSampler"]
  K --> R1["i2i #1"]
  K --> R2["i2i #2"]
  K --> RN["… i2i #8 (자동 반복)"]`,
    },
    lines: {
      10: "OUTPUT_IS_LIST = (True,) — 이 출력은 리스트라는 플래그(핀별 튜플). 다운스트림이 항목 수만큼 자동 반복.",
      17: "텐서 리스트를 반환 → ComfyUI가 8장 각각에 다운스트림을 한 번씩. 내가 루프를 안 짜도 됨.",
    },
  },
  // 1 — INPUT_IS_LIST = True
  {
    text: "방금과 정반대야. 기본적으로 ComfyUI는 리스트가 들어오면 쪼개서 항목마다 노드를 부르는데, INPUT_IS_LIST = True를 켜면 실행 메서드의 인자가 '항목 하나'가 아니라 '리스트 통째'로 들어와. 그래서 노드는 딱 한 번만 실행되고 내가 직접 순회해. 개수를 세거나, N장을 한 배치로 이어붙여 그리드를 만들거나, 리스트 전체를 봐야 하는 집계 작업에 써. 여기선 torch.cat으로 N장을 한 텐서로 합쳤어 — 이러면 '여러 장 → 한 장(그리드)'으로 차원이 줄어.",
    diagram: {
      title: "리스트를 쪼개지 않고 통째로",
      kind: "algorithm",
      summary: `flowchart LR
  IN["이미지 N장 리스트"] --> SW{"INPUT_IS_LIST?"}
  SW -->|"False(기본)"| EACH["항목마다 N번 실행"]
  SW -->|"True"| ONCE["한 번 실행 · 리스트 통째 수신"]
  ONCE --> CAT["torch.cat → 한 배치로 합침"]`,
    },
    lines: {
      8: "INPUT_IS_LIST = True — 인자를 항목별로 쪼개지 않고 '리스트 전체'로 받음. 노드는 한 번만 실행.",
      14: "torch.cat(images, dim=0) — N장을 배치 차원으로 이어붙여 한 텐서로. 집계·그리드의 핵심.",
    },
  },
  // 2 — control_after_generate (increment / decrement / randomize)
  {
    text: "매 큐마다 숫자를 자동으로 바꾸는 장치야. 중요한 포인트: 파이썬에선 그냥 평범한 INT 위젯을 선언만 해. 그러면 ComfyUI '프론트'가 그 INT 밑에 control_after_generate 드롭다운을 자동으로 붙여줘 — fixed(고정)·increment(+1)·decrement(−1)·randomize(랜덤). 큐를 실행할 때마다 이 규칙대로 그 값이 다음 값으로 갱신돼. 그래서 시드를 매번 randomize 하면 변주가 나오고, 인덱스를 increment 하면 리스트를 한 장씩 순회해. seed 위젯에 0xff..ff 같은 큰 max를 주는 건 시드 공간을 넓게 쓰려는 관용이야.",
    diagram: {
      title: "control_after_generate 가 매 큐 갱신",
      kind: "algorithm",
      summary: `flowchart TD
  INT["INT 위젯 선언"] --> AUTO["프론트가 드롭다운 자동 부착"]
  AUTO --> MODE{"control_after_generate"}
  MODE -->|increment| INC["다음 큐: 값 +1"]
  MODE -->|decrement| DEC["다음 큐: 값 −1"]
  MODE -->|randomize| RND["다음 큐: 랜덤"]
  MODE -->|fixed| FIX["그대로"]`,
    },
    lines: {
      9: "평범한 INT 위젯 — 이것만 선언하면 프론트가 control_after_generate 드롭다운을 자동으로 붙임.",
      10: "seed용 INT. max를 64비트로 크게 — randomize 시 시드 공간을 넓게 쓰려는 관용.",
      20: "index % n으로 순환. index가 매 큐 +1(increment)이면 이미지를 한 장씩 돌아가며 집음.",
    },
  },
  // 3 — lazy inputs + check_lazy_status
  {
    text: "조건부 계산의 1번 도구, lazy야. 입력에 \"lazy\": True를 달면 그 입력은 '요청하기 전엔 평가 안 됨' — 즉 업스트림이 아예 안 돌아. 흐름은 두 단계야: 먼저 ComfyUI가 check_lazy_status를 불러 '지금 실제로 필요한 입력 이름'을 리스트로 물어봐. 내가 use_a를 보고 [\"a\"] 또는 [\"b\"]를 돌려주면, ComfyUI는 그 가지만 계산해서 다시 run을 호출해. 결과적으로 안 고른 쪽의 무거운 연산(예: 큰 모델 추론)을 통째로 건너뛰는 거야. lazy가 없으면 a, b 둘 다 미리 계산돼 버려서 절반이 낭비돼.",
    diagram: {
      title: "lazy — 필요한 가지만 계산",
      kind: "algorithm",
      summary: `flowchart TD
  START["실행 요청"] --> CLS["check_lazy_status(use_a, a, b)"]
  CLS --> NEED{"어느 입력이 필요?"}
  NEED -->|"use_a=True"| A["'a'만 계산 → 업스트림 a 실행"]
  NEED -->|"use_a=False"| B["'b'만 계산 → 업스트림 b 실행"]
  A --> RUN["run() 재호출 (a 채워짐)"]
  B --> RUN`,
    },
    lines: {
      7: "\"lazy\": True — 이 입력은 요청 전엔 평가 안 됨. 업스트림이 안 돌아 무거운 연산을 아낌.",
      18: "check_lazy_status가 '실제 필요한 입력 이름'만 리스트로 반환 → ComfyUI가 그 가지만 계산 후 run 재호출.",
      21: "run에선 고른 쪽이 이미 계산돼 들어와 있음. 안 고른 쪽은 끝내 평가 안 됨.",
    },
  },
  // 4 — ExecutionBlocker for conditional branch
  {
    text: "lazy가 '필요한 가지만 계산'이라면, ExecutionBlocker는 '이 가지를 아예 막아라'야. 어떤 출력 핀으로 ExecutionBlocker(None)을 흘려보내면, 그 값을 받는 다운스트림 전체가 실행되지 않아 — if/else에서 거짓 쪽 가지를 통째로 꺼버리는 셈이지. None을 주면 조용히 막고 문자열을 주면 에러를 띄워. 여기선 enabled가 False면 ExecutionBlocker를, True면 진짜 이미지 텐서를 같은 핀으로 내보내. 받는 쪽 입장에선 '값이 차단됨'을 보고 그 경로를 스킵해. 분기에서 한쪽 라인을 완전히 죽이고 싶을 때 쓰고, comfy_execution.graph에서 가져와.",
    imports: [
      {
        name: "ExecutionBlocker",
        what: "다운스트림 실행을 막는 신호 객체(comfy_execution.graph)",
        use: "출력으로 흘려보내면 그 값을 받는 가지 전체가 실행 안 됨 — if/else 분기",
      },
    ],
    diagram: {
      title: "ExecutionBlocker — 가지 전체 끊기",
      kind: "algorithm",
      summary: `flowchart TD
  G["GateSprite.gate"] --> Q{"enabled?"}
  Q -->|True| PASS["이미지 텐서 출력 → 다운스트림 정상 실행"]
  Q -->|False| BLK["ExecutionBlocker(None) 출력"]
  BLK --> DEAD["받는 가지 전체 실행 안 됨"]`,
    },
    lines: {
      1: "ExecutionBlocker는 comfy_execution.graph에서 import. 흐름 차단 전용 신호 객체.",
      20: "ExecutionBlocker(None)을 출력 → 이 값을 받는 다운스트림 가지 전체가 실행 안 됨(거짓 쪽 차단).",
      21: "통과시킬 땐 평소처럼 진짜 텐서를 같은 핀으로. 같은 출력에 둘 중 하나를 골라 내보내 분기.",
    },
  },
];

export default explanations;
