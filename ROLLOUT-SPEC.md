# 콘텐츠 롤아웃 스펙 (에이전트 공통)

두 학습 앱의 나머지 파트를 **딥 리서치 기반 + 응용까지** 채운다. Part 1이 완성 샘플이니 톤·포맷을 그대로 따른다.

## 톤 (필수)
- **코드 해석**: 컴퓨터한테 반말로 지시하듯 + 개념을 곁들인다. "무엇을/왜". 딱딱한 설명체 금지. 예) "원본에 노이즈를 섞어. 그다음 모델한테 그걸 맞히라고 시켜 — 이게 학습 신호야."
- 한국어. 정확해야 한다(아래 리서치로 검증).

## 딥 리서치 (필수)
각 파트 작성 전 **WebSearch/WebFetch로 조사**한다:
- 최신 API/best practice가 맞는지 검증(특히 diffusers는 버전에 따라 API가 바뀜).
- **응용(applications)**: 이 기술이 실제로 어디에 쓰이는지(제품/워크플로우/조합). 한 파트에 최소 1개 응용 포인트를 녹인다(해석 문장이나 별도 markdown 셀로).

## 해석 엔트리 포맷
`ExplanationEntry = string | { text, imports?, diagram? }` (타입: 각 앱 `src/data/explanations/types.ts`).
- 코드 셀 1개 = 배열 항목 1개, **코드 셀 순서(codeIndex)와 정확히 일치**.
- 단순 셀은 그냥 문자열, 풍부한 셀은 객체.
- `imports` (import 셀): 라이브러리별 `{ name, what, use }`. **나열 순서 = 노트북에서 실제로 쓰이는 순서**(import순·알파벳순 아님). 거의 안 쓰는 건 맨 뒤.
- `diagram` (알고리즘/구조가 있는 셀): `{ title, kind: 'algorithm'|'architecture', summary, detail? }`.
  - `summary`/`detail`은 **Mermaid `flowchart TD`** 코드. 복잡한 알고리즘은 `detail`로 depth(축약→클릭 펼침).
  - 노드 라벨은 큰따옴표로 감싸고(`A["..."]`), `<br/>` 허용. **중괄호 `{}` 를 노드 텍스트에 넣지 말 것**(파서 깨짐) — 결정 노드는 `E{"t > 0 ?"}` 형태만. 수식은 √ · − → 같은 유니코드로.
- 라인 제한 없음(데이터 파일).

## A. diffusion 앱 (`cube-studyroom/diffusion`)
- 소스: `diffusion/public/notebooks/<notebookId>.json` (슬림 JSON). `cells` 배열에서 `type==="code"` 셀들을 순서대로 읽어 각 셀에 해석을 단다.
- 산출물: `diffusion/src/data/explanations/<notebookId>.ts`
  ```ts
  import type { ExplanationEntry } from "./types";
  const explanations: ExplanationEntry[] = [ /* 코드 셀 순서대로 */ ];
  export default explanations;
  ```
- `<notebookId>` = json 파일명(확장자 제외). 파일명도 그걸로.
- 템플릿 참고: `diffusion/src/data/explanations/part_1_simple_diffusion__diffusion_process.ts`.

## B. diffusers 앱 (`cube-studyroom/diffusers`)
- 소스: 실제 라이브러리 `E:\Analysis\diffusers-analysis\diffusers\src\diffusers\...` (해당 파일은 `diffusers/src/data/curriculum.ts`의 각 파트 `videos` 링크에 명시). **핵심 메서드만 발췌**(파일 통째 금지).
- 각 파트(2~8)는 `curriculum.ts`에 doc id 1개(`p2-scheduler` 등)가 있다. 그 파트당:
  - `diffusers/src/data/docs/<file>.ts` — `StudyDoc { id, title, cells: StudyCell[] }`. `id`는 curriculum의 doc id와 **정확히 일치**. cells = markdown + code 혼합.
    - markdown 섹션으로 **사용법 / 내부 동작(소스) / 응용** 셋을 모두 담는다.
  - `diffusers/src/data/explanations/<file>.ts` — `ExplanationEntry[]` (그 doc의 code 셀 순서대로).
- 템플릿 참고: `diffusers/src/data/docs/p1_usage.ts`, `p1_internals.ts` + `explanations/p1_usage.ts`, `p1_internals.ts`.

## 금지 (충돌 방지)
- `index.ts`(docs/explanations), `curriculum.ts`, 컴포넌트, `package.json`, 그 외 공용 파일 **수정 금지** — 오케스트레이터가 index를 배선한다.
- 빌드/`npm`/`git` 실행 금지(동시 실행 충돌).
- 배정받은 per-id 파일만 생성.

## 완료 보고
생성한 파일 경로 목록 + 각 파트에 어떤 리서치를 했는지 1줄 + diffusers면 각 doc의 code 셀 개수(해석 배열 길이 검증용).
