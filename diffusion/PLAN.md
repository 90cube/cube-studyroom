# Diffusion Study — 구현 플랜

디퓨전 강의(`../Diffusion_Gen_AI_Course`) 학습 허브. 10개 파트 로드맵 + 진도/타임라인 + 파트별 메모 + 노트북 인페이지 렌더링. 로컬 실행 전용(`npm run dev`), 영속화는 전부 localStorage.

## 스택
Vite + React + TS + Tailwind v4 + Motion(`motion/react`) + lucide-react. 노트북 렌더: react-markdown(+remark-gfm/remark-math/rehype-katex) + react-syntax-highlighter. 경로 별칭 `@` → `src`.

## 데이터 계약 (완료 — 변경 금지)
`scripts/build-notebooks.mjs` 가 생성:
- `public/notebooks/index.json` → `NotebookMeta[]`
- `public/notebooks/<id>.json` → `Notebook` (슬림 셀)
- `public/nb-assets/<id>/<hash>.<ext>` → 추출된 이미지
타입: `src/models/notebook.ts`. 출력 종류는 `stream | error | image | html | text` 5가지(실측: image/stream/text/error).

## 이미 작성됨 (Architect)
- `src/models/{notebook,curriculum,progress}.ts` — 타입
- `src/data/curriculum.ts` — 10파트 + 한국어 요약(`CURRICULUM`, `PART_BY_SLUG`)
- `src/data/constants.ts` — `STORAGE_KEYS`, `NOTEBOOKS_BASE`, URL들, `TOTAL_PARTS`
- `src/lib/utils.ts` — `cn()`
- `src/index.css` — Tailwind v4 + shadcn 토큰(라이트/다크, 바이올렛 primary) + `--color-success/-warning`

## 레이어 & 1파일1역할 (CANNOT 준수)
- Entry: `main.tsx`, `App.tsx` — 와이어링만, 로직 금지
- Domain(`src/domain/`): 순수 TS, 프레임워크 import 금지
- System(`src/system/`): 단일 책임
- Store(`src/store/`): 상태 컨테이너(React hook) — UI는 상태 보관 금지(여기 사용)
- UI(`src/components/`, `src/pages/`): 렌더만, 도메인 호출
- 로직 ~200줄/파일, CSS ~250줄. 초과 시 분할. 버튼 라벨은 구체적 동사+대상.

## Builder A — Logic (domain + system + store)
순수 로직. React는 store/hook에만.

`src/domain/progressLogic.ts`
- `computePartStatus(part: Part, pp?: PartProgress): PartStatus`
- `computePartPercent(part: Part, pp?: PartProgress): number` (0–100, 완료 노트북/전체)
- `computeOverall(curriculum: Part[], state: ProgressState): OverallStats`
  - `OverallStats = { percent, completedParts, totalParts, completedNotebooks, totalNotebooks }` (이 타입은 `src/models/progress.ts`에 추가)

`src/domain/timelineLogic.ts`
- `sortEventsDesc(events: TimelineEvent[]): TimelineEvent[]`
- `distinctStudyDays(events: TimelineEvent[]): number`
- `currentStreak(events: TimelineEvent[]): number` (오늘/어제 기준 연속 학습일)

`src/system/storage.ts` (localStorage, try/catch, SSR 가드 불필요)
- `loadProgress(): ProgressState` / `saveProgress(s): void`
- `loadTimeline(): TimelineEvent[]` / `saveTimeline(e): void`

`src/system/notebookLoader.ts`
- `loadNotebook(id: string): Promise<Notebook>` (fetch `${NOTEBOOKS_BASE}/${id}.json`)
- `loadIndex(): Promise<NotebookMeta[]>`

`src/store/useStudyStore.ts` (hook — 단일 진실원본)
```ts
interface StudyStore {
  progress: ProgressState;
  timeline: TimelineEvent[];
  getPart(partId: number): PartProgress;           // 기본값 포함 반환
  toggleNotebookDone(partId: number, notebookId: string): void;
  setMemo(partId: number, memo: string): void;     // 상태 즉시, 저장 디바운스(~600ms)
  resetPart(partId: number): void;
  overall: OverallStats;
}
```
규칙: 노트북 done 토글 → 해당 파트의 모든 노트북 done이면 part status=done(+completedAt, `part_completed` 이벤트), 첫 done이면 part status=in_progress(+startedAt, `part_started`). 노트북 done마다 `notebook_completed`. 메모 첫 저장 시 `memo_updated`(중복 남발 금지 — 같은 날 1회). 이벤트 id는 `crypto.randomUUID()`. 모든 변경은 storage에 영속.

`src/store/useTheme.ts` — `'light'|'dark'` 토글, `document.documentElement.classList`, `STORAGE_KEYS.theme`, 초기값 system.

## Builder B — UI (components + pages + wiring)
shadcn 스타일 + Motion 진입 애니메이션. 다크모드 필수(토큰 사용, 색 하드코딩 금지). 한국어 UI.

UI 프리미티브 `src/components/ui/`: `Button`, `Card`, `Badge`, `Progress`, `Tabs`, `Textarea` (cva + cn, shadcn 스타일).

컴포넌트 `src/components/`:
- `AppShell.tsx` — 헤더(로고/타이틀, 다크토글, 진도 미니바), 라우팅 아울렛
- `StatCard.tsx` — 메트릭 카드(전체 진도/완료 파트/학습 일수/연속일)
- `RoadmapTimeline.tsx` — 세로 타임라인형 10파트 리스트(번호 원형+커넥터, 상태 색: done=success, in_progress=warning+ring, not_started=muted)
- `PartCard.tsx` — 로드맵 항목(제목 ko/en, 노트북·유튜브 메타, 상태 pill, 진도바). 클릭 → `/part/:slug`
- `ConceptCard.tsx` — 한국어 개념 요약(markdown) + concepts 태그
- `NotebookViewer.tsx` — 노트북 1개 렌더(셀 순회). `useEffect`로 `loadNotebook` 비동기 로드, 로딩/에러 상태
  - `cells/MarkdownCell.tsx` — react-markdown(gfm+math+katex)
  - `cells/CodeCell.tsx` — Python 하이라이트 + 복사 버튼
  - `cells/OutputCell.tsx` — kind별: image(`<img loading=lazy>`), stream/text(`<pre>`), error(빨강 traceback), html(주의해 렌더)
- `NotebookTabs.tsx` — 파트에 노트북 2+개면 탭 전환
- `MemoEditor.tsx` — Textarea + 자동저장 표시("저장됨")
- `ProgressControls.tsx` — 노트북별 완료 체크 + 파트 리셋
- `YouTubeButtons.tsx` — videos 링크 버튼(새 탭)
- `TimelinePanel.tsx` — 이벤트 리스트(아이콘+날짜+설명), 대시보드는 최근 N개

페이지 `src/pages/`:
- `DashboardPage.tsx` — StatCard 그리드 + RoadmapTimeline + 최근 TimelinePanel
- `PartDetailPage.tsx` — useParams(slug)→PART_BY_SLUG, ConceptCard + YouTubeButtons + ProgressControls + NotebookTabs(NotebookViewer) + MemoEditor. 없는 slug → 대시보드 리다이렉트
- `TimelinePage.tsx` — 전체 타임라인

`src/App.tsx` — react-router: `/`=Dashboard, `/part/:slug`=PartDetail, `/timeline`=Timeline, `*`→`/`. AppShell 레이아웃.
`src/main.tsx` — BrowserRouter + `import './index.css'`. (App.css/assets 정리)

## 라우트
`/`, `/part/:slug`, `/timeline`

## 수용 기준 (QA + 검증)
1. `npm run build` 통과(tsc 포함), 경고 최소
2. 대시보드: 진도/통계/로드맵/타임라인 표시
3. 파트 진입: 한국어 요약 + 노트북 인페이지 렌더(코드 하이라이트 + 이미지 출력) + 메모 + 완료 체크
4. 진도/메모/타임라인 새로고침 후 유지(localStorage)
5. 다크/라이트 모두 정상(토큰 기반)
6. CANNOT 위반 없음(레이어 경계, 라인 제한, entry 로직 금지, UI 상태보관 금지, 하드코딩 금지)
7. Playwright로 대시보드+파트 화면 스크린샷 검증
