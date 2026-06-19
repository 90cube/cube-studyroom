# cube-studyroom

> Cube의 공부방 — 배우는 걸 전부 **코드로 정리**하는 학습 허브.

하나의 앱에서 홈으로 주제를 고르고, 각 주제를 코드·해석·다이어그램으로 학습합니다.
라이브: **https://cube-studyroom.pages.dev**

## 주제 (Topics)

| 주제 | 설명 | 경로 |
|---|---|---|
| 디퓨전 강의 | 디퓨전 모델 강의 — 노이즈에서 이미지까지, 직접 짠 코드로 10파트 | `/diffusion` |
| diffusers 라이브러리 | HF diffusers 코드 리딩 + 사용법 + 응용 — 파이프라인·스케줄러·U-Net·VAE 등 8파트 | `/diffusers` |

_앞으로 공부하는 주제마다 `src/topics/`에 추가됩니다._

## 구조

단일 앱(`diffusion/` 폴더 — 스터디룸 본체)이 모든 주제를 호스팅합니다.

```
cube-studyroom/
  diffusion/                # 스터디룸 앱 (Vite + React)
    src/
      topics/               # 주제 레지스트리 + 주제별 콘텐츠
      pages/ components/     # 홈·대시보드·파트·뷰어 (주제 공용)
      data/ explanations/    # 디퓨전 주제 데이터
```

- 홈 `/` → 주제 선택, `/:topic` → 대시보드, `/:topic/part/:slug` → 학습
- 진도/타임라인은 주제별 네임스페이스로 분리, 테마는 전역
- 디퓨전 주제는 노트북 JSON을, diffusers 주제는 authored 소스를 같은 뷰어로 렌더

## 실행

```bash
cd diffusion
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist (Cloudflare Pages 배포)
```

> 디퓨전 주제 노트북은 형제 경로의 강의 클론(`Diffusion_Gen_AI_Course`)에서 전처리합니다.
> 자세한 내용은 [diffusion/README.md](./diffusion/README.md).
