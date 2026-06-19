# cube-studyroom

> Cube의 공부방 — 배우는 걸 전부 **코드로 정리**하는 학습 모노레포.

공부하는 주제마다 독립 폴더로 담고, 코드·노트·인터랙티브 학습물로 정리합니다.

## 주제 (Topics)

| 주제 | 설명 | 경로 |
|---|---|---|
| Diffusion & Gen AI | 디퓨전 모델 강의 학습 허브 — 10파트 로드맵 · 진도/타임라인 · 노트북 인페이지 뷰어 | [`diffusion/`](./diffusion) |
| diffusers 라이브러리 | HF diffusers 코드 리딩 + 사용법 — 파이프라인·스케줄러·U-Net·VAE 등 8파트 | [`diffusers/`](./diffusers) |

_앞으로 공부하는 주제마다 폴더가 늘어납니다._

## 구조

```
cube-studyroom/
  diffusion/      # 디퓨전 강의 (노트북 렌더링)
  diffusers/      # HF diffusers 라이브러리 (코드 리딩 + 사용법)
  <next-topic>/   # 이후 추가
```

두 앱은 같은 컴포넌트 패턴(뷰어·해석·다이어그램·진도)을 공유합니다.

각 주제 폴더는 자체 README와 실행법을 가집니다. 예) 디퓨전 앱:

```bash
cd diffusion
npm install
npm run dev      # http://localhost:5173
```

자세한 내용은 [diffusion/README.md](./diffusion/README.md) 참고.
