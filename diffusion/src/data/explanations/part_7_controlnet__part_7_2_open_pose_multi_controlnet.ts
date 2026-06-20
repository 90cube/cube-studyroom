// Part 7.2 OpenPose & Multi-ControlNet 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports + OpenPose ControlNet 파이프라인 로드
  {
    text: "이번 구조 조건은 외곽선이 아니라 '사람의 자세(포즈)'야. control_v11p_sd15_openpose ControlNet을 SD1.5에 끼워서, 막대인간 골격(스켈레톤)을 따라 인물을 그리게 만들어. 스케줄러는 빠른 UniPC, 진행 막대는 꺼서(set_progress_bar_config(disable=True)) 출력을 깔끔하게 해. 캐릭터·아바타·패션 생성에서 '자세는 이대로, 외형은 프롬프트대로'를 만드는 게 OpenPose ControlNet의 주특기야.",
    imports: [
      {
        name: "torch",
        what: "PyTorch — 텐서·GPU·시드",
        use: "float16 로드, device 선택, manual_seed로 생성 재현",
      },
      {
        name: "diffusers.utils.load_image",
        what: "이미지 로더",
        use: "포즈를 뽑을 참조 이미지(luffy.png)를 불러와",
      },
      {
        name: "ControlNetModel · StableDiffusionControlNetPipeline",
        what: "ControlNet 본체 + SD 파이프라인",
        use: "openpose 체크포인트를 끼워 포즈 조건 생성",
      },
      {
        name: "UniPCMultistepScheduler",
        what: "빠른 샘플러",
        use: "기본 스케줄러 교체로 적은 스텝 생성",
      },
      {
        name: "controlnet_aux.OpenposeDetector",
        what: "이미지에서 인체 골격을 추출하는 전처리기",
        use: "참조 사진 → 막대인간 포즈 맵(control_image) 생성",
      },
      {
        name: "tqdm.auto.tqdm",
        what: "진행률 표시줄",
        use: "프롬프트·스케일 스윕 루프의 진행 표시",
      },
      {
        name: "numpy · cv2 · PIL · matplotlib · os · pathlib · HfApi",
        what: "배열·비전·이미지·플롯·경로 유틸",
        use: "포즈/뎁스 맵 가공과 결과 시각화에 보조로",
      },
    ],
  },
  // 1 — 참조 이미지 로드 + OpenposeDetector 준비
  "포즈를 뽑을 준비를 해. 참조 이미지(luffy.png)를 불러오고, OpenposeDetector를 'lllyasviel/ControlNet'에서 받아 device에 올려. 이 detector가 사진 속 사람의 관절을 찾아 막대인간으로 그려줄 도구야 — 아직 실행은 안 했고, 다음 셀에서 이미지에 적용할 거야.",
  // 2 — 포즈 맵 추출 + 시각화
  "참조 이미지에 detector를 돌려 포즈 맵을 뽑아(hand_and_face=True라 손가락·얼굴 키포인트까지 잡아). 결과는 검은 배경에 색색의 막대로 골격이 그려진 control_image야. 원본과 포즈 맵을 나란히 그려서, 사람의 자세가 어떻게 막대인간으로 추상화됐는지 확인해. 이 골격만 모델한테 주면 외형은 자유롭게, 포즈는 고정돼.",
  // 3 — 여러 프롬프트로 같은 포즈 재활용
  "같은 포즈 골격을 고정하고 프롬프트만 5개(사이버펑크·중세·SF·스트리트웨어·스팀펑크)로 바꿔 돌려. 자세는 그대로인데 캐릭터 컨셉만 완전히 달라지는 걸 5×3 격자로 보여줘. 게임·웹툰에서 한 포즈 시트로 여러 의상·세계관 변주를 양산할 때 쓰는 실전 패턴이야 — 콘티의 자세를 박아두고 룩만 갈아끼우는 거.",
  // 4 — ControlNet 강도 스윕
  "포즈를 얼마나 충실히 따를지(controlnet_conditioning_scale)를 0.1→1.0으로 훑어. 낮으면 골격을 느슨히 참고해 프롬프트가 자세를 흐트러뜨리고, 높으면 막대인간에 딱 붙은 자세가 나와. 인물 생성에서 '포즈 고정 강도'를 조절하는 다이얼이야 — 너무 높이면 뻣뻣하고, 적당히 낮추면 자연스러운 변형이 섞여.",
  // 5 — Inpaint 파이프라인(from_pipe 재활용)
  "이미 만든 파이프라인의 부품을 그대로 재활용해 인페인팅 버전을 만들어(from_pipe). 모델·VAE·텍스트 인코더를 다시 로드하지 않고 메모리에서 공유하니까 빠르고 VRAM도 아껴. 스케줄러만 UniPC로 다시 맞춰. 같은 포즈 ControlNet으로 '사진 일부만 자세를 지키며 다시 그리기'를 할 준비야.",
  // 6 — 마스크 생성 + 시각화
  "인페인팅할 영역 마스크를 만들어. 원본 크기의 0 배열에서 아래쪽(250행부터 끝까지)을 1로 채워 '여기 아래를 새로 그려'라고 지정하고, gaussian_filter로 경계를 살짝 번지게 해 이음새를 부드럽게 해. 원본·포즈 맵·마스크 오버레이를 나란히 확인해 — 인물의 하반신만 교체하는 시나리오야.",
  // 7 — Inpaint 단일 생성
  "마스크 친 하반신을 '패드를 찬 크리켓 선수'로 새로 그려. 원본·마스크·포즈 맵(원본 크기로 resize)을 함께 넘기고 controlnet_conditioning_scale=0.9로 포즈를 강하게 지켜. 마스크 밖(상반신·얼굴)은 원본 그대로 보존되고, 마스크 안쪽만 골격을 따라 새 옷·장비로 바뀌어. 캐릭터의 일부 의상만 교체하는 합성 워크플로우야.",
  // 8 — Inpaint strength 스윕
  "인페인트 strength(0.1→1.0)를 훑어. 낮으면 원본 픽셀을 많이 남겨 살짝만 손대고, 높으면 마스크 영역을 거의 새로 칠해. 포즈 조건은 계속 유지되니까 '얼마나 갈아엎든 자세는 그대로'인 채로 변형 강도만 달라지는 걸 한 줄 격자로 비교해.",
  // 9 — Multi-ControlNet imports + 포즈+뎁스 파이프라인
  {
    text: "여기서부터 ControlNet 두 개를 동시에 써. 포즈(openpose)와 뎁스(depth) ControlNet을 둘 다 로드해 controlnet=[pose, depth] 리스트로 파이프라인에 끼워. 포즈만으로는 팔다리의 앞뒤 관계(누가 앞에 있나)가 애매할 때가 있는데, 뎁스 맵을 겹쳐주면 그 전후 관계까지 잡혀 자세가 안 무너져. 캐릭터 아트·건축/인테리어 시각화에서 '레이아웃은 뎁스로, 인물 포즈는 골격으로' 이중 구속을 거는 실전 조합이야.",
    imports: [
      {
        name: "ControlNetModel (×2: openpose, depth)",
        what: "포즈/뎁스 두 ControlNet",
        use: "리스트로 묶어 한 파이프라인에 동시 주입 — 다중 구조 제어",
      },
      {
        name: "StableDiffusionControlNetPipeline",
        what: "다중 ControlNet을 받는 SD 파이프라인",
        use: "image=[포즈맵, 뎁스맵], conditioning_scale=[s1, s2]로 둘을 합성",
      },
      {
        name: "controlnet_aux.OpenposeDetector",
        what: "포즈 전처리기",
        use: "참조 이미지에서 골격 맵을 다시 추출",
      },
      {
        name: "UniPCMultistepScheduler · tqdm · numpy · cv2 · PIL · matplotlib",
        what: "샘플러·진행바·배열·비전·플롯",
        use: "두 조건 맵 가공과 스케일 격자 시각화",
      },
    ],
  },
  // 10 — 뎁스 추정기 + 포즈 전처리기 준비
  "두 종류의 조건 맵을 뽑을 전처리기를 준비해. transformers.pipeline('depth-estimation')로 뎁스 추정기를(기본 Intel/dpt-large 모델), OpenposeDetector로 포즈 추출기를 각각 만들어. 하나는 '카메라로부터의 거리(뎁스)'를, 하나는 '관절 골격(포즈)'을 만들어낼 거야 — 같은 원본에서 서로 다른 두 구조 정보를 뽑는 거지.",
  // 11 — 뎁스 맵 생성
  {
    text: "참조 이미지로 뎁스 맵을 만들어. depth_estimator를 돌려 거리 정보를 흑백으로 받고, 1채널을 3번 쌓아 RGB로 만든 뒤 (512,786)으로 맞춰. 가까운 곳은 밝게/먼 곳은 어둡게 표현된 이 맵이 장면의 3D 구조(앞뒤·깊이)를 모델에 알려줄 거야. (보라색 줄 hover 참고.)",
    lines: {
      2: "['depth']로 깊이 맵만 꺼내기 — 픽셀마다 카메라로부터의 거리(밝을수록 가까움).",
      4: "채널 축 추가: (H,W) → (H,W,1).",
      5: "3번 쌓아 RGB 3채널로 — depth ControlNet 입력 형식 맞추기(Canny 때와 같은 트릭).",
    },
  },
  // 12 — 포즈 맵 생성
  {
    text: "같은 참조 이미지로 포즈 맵도 만들어(hand_and_face=True). 뎁스 맵과 크기를 똑같이 (512,786)으로 맞춰야 두 조건이 픽셀 단위로 정렬돼 함께 들어갈 수 있어. 이제 '깊이 지도'와 '골격 지도' 두 장이 같은 좌표계에 준비됐어. (보라색 줄 hover 참고.)",
    lines: {
      1: "processor(..., hand_and_face=True)로 손·얼굴 키포인트까지 골격 추출 → 뎁스와 같은 (512,786)로 resize. 크기가 같아야 픽셀 단위로 정렬돼 두 조건을 함께 먹임.",
    },
  },
  // 13 — 두 조건 맵 + 원본 시각화
  "뎁스 맵·포즈 맵·원본을 나란히 그려서 셋을 비교해. 같은 인물을 서로 다른 두 방식으로 추상화한 게 한눈에 보여 — 하나는 입체감(거리), 하나는 자세(관절). 다음 셀에서 이 둘을 동시에 모델에 먹일 거라 그 전에 정렬과 내용을 눈으로 점검하는 단계야.",
  // 14 — 다중 ControlNet 스케일 격자 스윕
  {
    text: "두 ControlNet의 강도를 격자로 훑어 최적 조합을 찾아. 포즈 스케일(s1)과 뎁스 스케일(s2)을 각각 0.0→1.0으로 6단계씩, 6×6=36칸을 돌려. image=[포즈맵, 뎁스맵]에 controlnet_conditioning_scale=[s1, s2]로 둘의 비중을 따로 줘. 격자를 보면 한쪽이 0이면 그 조건이 빠지고, 둘 다 높으면 자세와 깊이를 동시에 강하게 구속하는 게 보여 — 실전에선 이렇게 스윕해서 '포즈는 충실, 깊이는 은은하게' 같은 황금비를 찾아 쓰는 거야. negative_prompt로 해부학 오류도 억눌러. (보라색 줄 hover 참고.)",
    lines: {
      6: "★조건 이미지를 리스트로 — [포즈맵, 뎁스맵]. 순서가 controlnet=[pose, depth] 로드 순서와 일치해야 해.",
      20: "negative_prompt = '이런 건 빼줘'(해부학 오류·저화질). 두 조건과 별개로 품질을 끌어올림.",
      21: "image=images = 두 구조 맵을 동시에 입력 — 단일 ControlNet과 달리 리스트.",
      23: "★scale도 [s1, s2] 리스트 — 포즈 비중·뎁스 비중을 따로 조절. 한쪽 0이면 그 조건 끔.",
    },
    diagram: {
      title: "다중 ControlNet 합성 (포즈 + 뎁스)",
      kind: "architecture",
      summary: `flowchart TD
  P["포즈 맵"] --> CNP["ControlNet 1<br/>(openpose)"]
  D["뎁스 맵"] --> CND["ControlNet 2<br/>(depth)"]
  CNP -->|"× s1"| U["얼린 SD UNet"]
  CND -->|"× s2"| U
  T["프롬프트"] --> U
  U --> O["생성: 자세+깊이 동시 만족"]`,
      detail: `flowchart TD
  P["pose_control_image"] --> CNP["controlnet[0] openpose"]
  D["depth_control_image"] --> CND["controlnet[1] depth"]
  CNP --> RP["down/mid 잔차 (포즈)"]
  CND --> RD["down/mid 잔차 (뎁스)"]
  RP -->|"× s1"| SUM(("잔차 합산"))
  RD -->|"× s2"| SUM
  T["prompt + negative_prompt → CLIP"] --> U["얼린 UNet"]
  SUM --> U
  U --> N["노이즈 예측"]
  N --> ST["scheduler.step (20스텝)"]
  ST --> O["디코드 → 결과"]
  O --> GRID["s1×s2 6×6 격자 비교"]`,
    },
  },
];

export default explanations;
