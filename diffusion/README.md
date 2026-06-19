# 디퓨전 스터디 (Diffusion Study)

[mohan696matlab/Diffusion_Gen_AI_Course](https://github.com/mohan696matlab/Diffusion_Gen_AI_Course) 강의를 보기 편하게 정리한 **로컬 학습 허브**.
10개 파트 로드맵 · 진도/타임라인 추적 · 파트별 메모 · 노트북 인페이지 렌더링.

## 필요 조건
- Node 18+ (개발: Node 24)
- 강의 레포가 **이 폴더 옆 형제 경로**에 있어야 함:
  ```
  <parent>/
    Diffusion_Gen_AI_Course/   ← 원본 강의 (git clone)
    diffusion-study/           ← 이 앱
  ```
  없다면: `git clone https://github.com/mohan696matlab/Diffusion_Gen_AI_Course.git` 를 옆에 클론.

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
```
`predev`/`prebuild` 훅이 노트북 전처리를 자동 실행합니다(이미 생성돼 있으면 건너뜀).

## 빌드
```bash
npm run build    # tsc + vite build → dist/
npm run preview  # 빌드 결과 미리보기
```

## 노트북 전처리
`scripts/build-notebooks.mjs` 가 강의 레포의 `.ipynb` 를 읽어:
- 셀만 담은 슬림 JSON → `public/notebooks/<id>.json` (+ `index.json`)
- 박힌 base64 이미지 → `public/nb-assets/<id>/<hash>.png` 로 추출(해시 중복제거)

파이썬/주피터 불필요(Node 단독). 강제 재생성:
```bash
npm run notebooks    # --force
```
> 생성물(`public/notebooks`, `public/nb-assets`)은 `.gitignore` 처리됨 — 위 명령으로 언제든 재생성.

## 데이터 저장
진도·완료 날짜·메모·학습 타임라인은 전부 브라우저 **localStorage** 에 저장됩니다(서버 없음).

## 구조 (1파일1역할)
```
src/
  models/      타입 정의만
  data/        커리큘럼 + 한국어 개념 요약, 상수
  domain/      순수 로직(진도/타임라인 계산) — 프레임워크 import 없음
  system/      localStorage, 노트북 로더
  store/       상태 컨테이너(React hook + Context)
  components/   UI (cells/ = 노트북 셀 렌더러, ui/ = 프리미티브)
  pages/        Dashboard / PartDetail / Timeline
```

자세한 설계는 [PLAN.md](./PLAN.md) 참고.
