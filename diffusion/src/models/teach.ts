// Teaching-method data, ported from the `teach` skill's principles:
// - 1차 출처(primary source): 파트마다 가장 신뢰할 자료 하나 ("꼭 볼 것")
// - 인출연습(recall): 복습 모드가 토픽을 넘나들며 섞어 출제하는 회상 카드
// 미션(왜 배우나)은 토픽 단위라 registry의 TopicOverview.mission 에 둔다.

/** 파트마다 추천하는 단 하나의 고신뢰 1차 자료. */
export interface PrimarySource {
  title: string;
  url: string;
  why: string; // 왜 이걸 봐야 하나 (한 줄)
}

/** 복습 모드의 최소 단위 — 회상 질문 1개. */
export interface RecallItem {
  q: string; // 인출 질문 (기억에서 꺼내게)
  a: string; // 정답 (간결하게)
  hint?: string; // 막히면 펼치는 힌트
}

/** 한 파트의 teach 보강 데이터. */
export interface PartTeach {
  primarySource: PrimarySource;
  recall: RecallItem[];
}
