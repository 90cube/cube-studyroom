// Part 9-2 코드 해석문 — 코드 셀 순서(codeIndex)대로.
// 톤: 컴퓨터에게 구어체로 지시하듯, 무엇을 왜 시키는지 풀어쓰기.

import type { ExplanationEntry } from "./types";

const explanations: ExplanationEntry[] = [
  // 0 — imports (training stack)
  {
    text: "이번엔 '남이 만든 LoRA를 쓰는' 게 아니라 'LoRA를 직접 학습'시킬 거라 연장통이 훨씬 두툼해. 파이프라인을 통째로 부르는 대신 VAE·U-Net·텍스트 인코더를 따로따로 꺼내 쓰고, peft로 LoRA 어댑터를 손수 붙여. 각 도구가 어디 쓰일지는 아래 참고.",
    imports: [
      {
        name: "torch · F (functional)",
        what: "PyTorch 본체 + 손실함수 모음",
        use: "학습의 심장 — 텐서 연산, 옵티마이저, F.mse_loss로 노이즈 예측 오차 계산",
      },
      {
        name: "diffusers · AutoencoderKL · UNet2DConditionModel",
        what: "SD의 부품들을 따로 불러오는 클래스",
        use: "통짜 파이프라인 대신 VAE(AutoencoderKL)·U-Net을 개별 로드해서 U-Net에만 LoRA를 붙여",
      },
      {
        name: "diffusers · DDPMScheduler",
        what: "학습용 노이즈 스케줄러",
        use: "forward 과정 — add_noise로 latent에 정해진 만큼 노이즈를 섞을 때 써",
      },
      {
        name: "transformers · CLIPTokenizer · CLIPTextModel",
        what: "프롬프트를 토큰화하고 임베딩으로 바꾸는 CLIP",
        use: "'platypus' 캡션을 숫자 토큰 → 텍스트 임베딩으로 변환해 U-Net 조건으로 넣어줘",
      },
      {
        name: "peft · LoraConfig · get_peft_model_state_dict",
        what: "허깅페이스 PEFT — LoRA를 정의·추출하는 라이브러리",
        use: "LoraConfig로 LoRA 설정을 짜서 unet.add_adapter로 붙이고, 학습 끝나면 LoRA 가중치만 뽑아내",
      },
      {
        name: "diffusers.utils.convert_state_dict_to_diffusers",
        what: "PEFT state_dict → diffusers 저장 포맷 변환기",
        use: "체크포인트 저장 직전, peft 키 이름을 diffusers가 다시 읽을 수 있는 키로 바꿔줘",
      },
      {
        name: "torch.utils.data (Dataset · DataLoader) · torchvision.transforms",
        what: "데이터셋 래핑 + 배치 묶기 + 이미지 전처리",
        use: "platypus 사진들을 Dataset으로 감싸고 512×512로 리사이즈·정규화해 배치로 흘려보내",
      },
      {
        name: "DiffusionPipeline · StableDiffusionPipeline · DPMSolverMultistepScheduler · DDIMScheduler",
        what: "추론용 파이프라인·샘플러들",
        use: "학습 중간중간 결과를 뽑아볼 때(generate_and_save)와 마지막 추론에 써",
      },
      {
        name: "tqdm · matplotlib · PIL · Path · os · shutil · random",
        what: "진행바·플롯·이미지·경로·파일·난수 유틸",
        use: "학습 루프 진행바, 손실 곡선·샘플 그림, 체크포인트 폴더 생성 같은 살림살이",
      },
    ],
  },
  // 1 — transform
  "이미지 전처리 레시피를 정해. 모든 사진을 512×512로 맞추고, 텐서로 바꾼 뒤 [-1, 1] 범위로 정규화(평균0.5·표준편차0.5)해 — SD가 학습된 그 범위에 맞추는 거야. 좌우 뒤집기(RandomHorizontalFlip)도 섞어서 적은 사진으로도 데이터를 살짝 부풀려.",
  // 2 — preview transformed images
  "전처리가 제대로 먹었는지 platypus 폴더의 사진들을 한 장씩 직접 그려서 확인해. 정규화로 [-1,1]이 됐으니 화면에 띄울 땐 *0.5+0.5로 다시 [0,1]로 되돌려서 사람 눈에 정상으로 보이게 해.",
  // 3 — device
  "GPU가 있으면 GPU를 쓰도록 device를 잡아둬. 앞으로 모델과 텐서를 전부 이 장치로 보낼 거야.",
  // 4 — load all components (frozen)
  {
    text: "통짜 파이프라인 대신 부품을 하나씩 불러와: VAE(이미지↔latent 변환), U-Net(노이즈 예측), 토크나이저+텍스트 인코더(프롬프트 처리), 노이즈 스케줄러. 전부 GPU로 올린 다음 핵심 한 방 — 셋 다 requires_grad_(False)로 '얼려'. 원본 가중치는 절대 안 건드리고, 곧 붙일 LoRA 어댑터 층만 학습할 거니까.",
    diagram: {
      title: "부품 로드 + 동결(freeze)",
      kind: "architecture",
      summary: `flowchart TD
  ID["model_id (SD1.5)"] --> VAE["VAE (AutoencoderKL)"]
  ID --> UNET["U-Net"]
  ID --> TOK["CLIPTokenizer"]
  ID --> TENC["CLIPTextModel"]
  ID --> SCH["DDPMScheduler"]
  VAE --> FZ["requires_grad_(False)<br/>= 동결"]
  TENC --> FZ
  UNET --> FZ
  FZ --> NOTE["원본은 그대로 →<br/>나중에 붙일 LoRA만 학습"]`,
    },
  },
  // 5 — Dataset class
  "사진들을 모델이 먹기 좋게 감싸는 Dataset을 정의해. 인덱스로 사진 한 장을 요청하면, 그걸 열어 전처리(transform)한 이미지와 'platypus'라는 캡션을 한 쌍으로 돌려줘. 여기선 사진이 전부 같은 대상이라 캡션을 'platypus'로 고정했어.",
  // 6 — dataset + dataloader
  "방금 만든 Dataset을 DataLoader로 감싸 배치 단위(2장씩)로 묶고, 매 에폭 순서를 섞어(shuffle) 흘려보내게 해. 이제 for 한 줄로 사진을 2장씩 꺼내 쓸 수 있어.",
  // 7 — peek a batch
  "DataLoader가 진짜로 잘 도는지 배치 하나만 꺼내 형태를 찍어봐. 이미지 텐서가 [2, 3, 512, 512](2장·RGB·512²)이고 캡션이 ['platypus','platypus']로 나오면 정상이야. 디버깅용 한 번 확인.",
  // 8 — encode image to latent (VAE)
  {
    text: "사진을 VAE로 'latent(잠재 표현)'로 압축해. SD는 512×512 픽셀을 직접 다루는 게 아니라 VAE가 줄여놓은 4×64×64 작은 공간에서 학습·생성해 — 그래야 계산이 가볍거든. scaling_factor를 곱하는 건 SD가 학습된 latent 크기 규약에 맞추는 표준 절차야. inference_mode라 VAE엔 기울기가 안 흘러(동결 유지).",
    diagram: {
      title: "VAE 인코딩 (이미지 → latent)",
      kind: "architecture",
      summary: `flowchart TD
  IMG["이미지 텐서<br/>[2, 3, 512, 512]"] --> ENC["vae.encode → latent_dist"]
  ENC --> SMP["sample()"]
  SMP --> SCALE["× scaling_factor"]
  SCALE --> Z["latent<br/>[2, 4, 64, 64]"]`,
    },
  },
  // 9 — encode caption to text embeddings
  "캡션 'platypus'를 CLIP으로 처리해. 먼저 토크나이저가 글자를 숫자 토큰으로 바꾸고(길이 77로 패딩), 텍스트 인코더가 그걸 [2, 77, 768] 임베딩으로 펼쳐. 이게 곧 U-Net한테 '무엇을 그릴지' 알려주는 조건(condition)이 돼. 여기도 동결이라 기울기 없음.",
  // 10 — gradient checkpointing
  "학습 메모리를 아끼는 스위치를 켜. gradient_checkpointing은 순전파 때 중간 결과를 다 들고 있는 대신, 역전파 때 필요한 부분을 그때그때 다시 계산하는 방식 — 속도를 약간 내주고 VRAM을 크게 아껴. (xformers 줄은 주석 — 같은 목적의 또 다른 최적화 옵션이야.)",
  // 11 — LoRA config + add_adapter
  {
    text: "드디어 LoRA를 설계해서 U-Net에 붙여. r=32는 보정 행렬의 '랭크(용량)' — 클수록 표현력↑·파일↑. lora_alpha는 그 효과의 세기 스케일. init은 가우시안 랜덤으로 시작. 핵심은 target_modules — 어텐션의 to_k·to_q·to_v·to_out에만 LoRA를 꽂아. add_adapter 한 줄이면 그 자리마다 작은 A·B 행렬이 끼워지고, 이제 학습 대상은 오직 이 A·B뿐이야.",
    diagram: {
      title: "LoRA 어댑터 부착",
      kind: "architecture",
      summary: `flowchart TD
  CFG["LoraConfig<br/>r=32 · alpha=32 · gaussian"] --> TM["target_modules:<br/>to_k · to_q · to_v · to_out.0"]
  TM --> ADD["unet.add_adapter(cfg)"]
  ADD --> RES["각 어텐션 투영층 옆에<br/>A(32차원)·B 행렬 삽입"]
  RES --> TRAIN["학습 대상 = A·B 뿐<br/>원본 가중치는 freeze 유지"]`,
    },
  },
  // 12 — inspect requires_grad
  "U-Net의 모든 파라미터를 훑으며 '학습됨(True)/동결됨(False)'을 찍어봐. 출력에서 base_layer.weight는 전부 False, lora_A·lora_B만 True로 뜨면 제대로 된 거야 — 거대한 원본은 잠겨 있고 우리가 끼운 작은 LoRA만 학습되는 상태를 눈으로 검증하는 셈이지.",
  // 13 — optimizer
  "옵티마이저를 준비해. filter로 'requires_grad=True인 파라미터' 즉 LoRA의 A·B만 골라서 AdamW에 넘겨 — 원본은 어차피 안 움직이니 빼는 거야. 학습률 1e-4에 weight_decay로 살짝 규제를 걸고, unet.train()으로 모델을 학습 모드로 전환해.",
  // 14 — generate_and_save helper
  {
    text: "학습 도중 'LoRA가 지금 얼마나 platypus를 배웠나' 눈으로 보려고, 현재 U-Net으로 4장 뽑아 PNG로 저장하는 헬퍼를 정의해. 동결된 VAE·텍스트 인코더·토크나이저에 '지금 학습 중인 U-Net'을 합쳐 임시 파이프라인을 조립하고, DDIM 스케줄러로 'platypus' 4장을 생성해 격자로 저장한 뒤 메모리를 비워. 학습 자체엔 영향 없는 '중간 점검 카메라'야.",
    diagram: {
      title: "중간 샘플 생성 헬퍼",
      kind: "algorithm",
      summary: `flowchart TD
  A["unet.eval()"] --> B["임시 파이프라인 조립<br/>(동결 VAE/TE + 학습중 U-Net)"]
  B --> C["DDIM 으로 'platypus' 4장 생성"]
  C --> D["격자로 runs/.../step_N.png 저장"]
  D --> E["empty_cache() 후 경로 반환"]`,
    },
  },
  // 15 — training loop
  {
    text: "학습 루프 본체 — 5000스텝 동안 돌려. 한 스텝마다: (1) 사진을 latent로, 캡션을 임베딩으로 인코딩하고 (2) latent에 무작위 timestep만큼 노이즈를 섞어(forward) (3) U-Net한테 '낀 노이즈 맞혀봐' 시킨 뒤 (4) 실제 노이즈와의 MSE 오차로 LoRA를 조금씩 고쳐. 메모리 절약 위해 4스텝 모은 뒤 한 번 갱신(gradient accumulation)하고, 1000스텝마다 LoRA 체크포인트를 저장하고 중간 샘플을 뽑아. 끝나면 손실 곡선을 그려 — 내려가면 platypus를 배우고 있는 거야.",
    diagram: {
      title: "LoRA 학습 루프",
      kind: "algorithm",
      summary: `flowchart TD
  A["배치 꺼내기 (사진+캡션)"] --> B["latent·텍스트 임베딩 인코딩"]
  B --> C["랜덤 t·노이즈로 noisy latent 생성"]
  C --> D["U-Net이 노이즈 예측"]
  D --> E["MSE 손실 → backward (LoRA만)"]
  E --> F{"4스텝마다 ?"}
  F -->|예| G["optimizer.step / zero_grad"]
  F -->|아니오| A
  G --> H{"1000스텝마다 ?"}
  H -->|예| I["LoRA 저장 + 샘플 생성"]
  H -->|아니오| A
  I --> A`,
      detail: `flowchart TD
  START["while step < 5000"] --> ENC["encoder_hidden = text_encoder(caption)<br/>latent = vae.encode(img)·scaling_factor"]
  ENC --> NZ["noise ~ N(0, I)"]
  NZ --> T["t = 무작위 timestep (배치마다)"]
  T --> ADD["noisy = scheduler.add_noise(latent, noise, t)"]
  ADD --> PRED["model_pred = unet(noisy, t, encoder_hidden)"]
  PRED --> LOSS["loss = MSE(model_pred, noise) / 4"]
  LOSS --> BWD["loss.backward()  — LoRA A·B에만 기울기"]
  BWD --> ACC{"(step+1) %4 == 0 ?"}
  ACC -->|예| STEP["optimizer.step(); zero_grad()"]
  ACC -->|아니오| NEXT
  STEP --> EVAL{"step %1000 == 0 ?"}
  EVAL -->|예| SAVE["convert_state_dict_to_diffusers(get_peft_model_state_dict)<br/>→ save_lora_weights + generate_and_save"]
  EVAL -->|아니오| NEXT
  SAVE --> NEXT["step++"]
  NEXT --> START
  START --> PLOT["끝: running_loss 곡선 그리기"]`,
    },
  },
  // 16 — inference imports
  {
    text: "여기서부터는 '학습 끝, 이제 써먹기' 파트야. 추론에 필요한 도구만 다시 가볍게 불러와 — 통짜 StableDiffusionPipeline과 DDIM 스케줄러면 충분해. (커널을 새로 시작해도 이어서 돌아가게 import를 다시 적어둔 거야.)",
    imports: [
      {
        name: "diffusers · StableDiffusionPipeline · DDIMScheduler",
        what: "추론용 통짜 파이프라인 + 빠른 샘플러",
        use: "방금 학습한 LoRA 체크포인트를 얹어 platypus를 생성하는 데 써",
      },
      {
        name: "torch · matplotlib · PIL · transforms · tqdm · clear_output · Path · load_image",
        what: "텐서·플롯·이미지·전처리·진행바·경로 유틸",
        use: "시드 고정 생성과 결과 격자 표시 — 나머지는 시리즈 공통 import",
      },
    ],
  },
  // 17 — load fresh pipeline
  "깨끗한 SD1.5 파이프라인을 fp16으로 다시 불러오고 스케줄러를 DDIM으로 바꿔. 아직 LoRA는 안 붙은 '맨몸' 상태 — 곧 우리가 학습시킨 어댑터를 얹어서 전/후를 비교할 거야.",
  // 18 — baseline (scale 0.0, clip_skip)
  "LoRA를 붙이기 전 베이스라인을 시드 5개로 뽑아 깔아. scale=0.0이라 LoRA 효과 0%(아직 없기도 하고). clip_skip=2는 텍스트 인코더의 마지막 층 하나를 건너뛰어 임베딩을 뽑는 옵션 — 커뮤니티 SD1.5 모델에서 흔히 쓰는 화질 트릭이야.",
  // 19 — load trained LoRA
  "방금 학습해 저장한 LoRA 체크포인트(runs/ckpt_2000)를 파이프라인에 얹어. 허브가 아니라 '내가 방금 만든 로컬 폴더'에서 불러온다는 게 핵심 — 9-1에선 남의 LoRA를 받았다면, 여기선 내가 구운 LoRA를 끼우는 거야.",
  // 20 — generate with trained LoRA (scale 1.0)
  "내 LoRA를 full(scale=1.0)로 적용해 한 장 뽑아봐. 18번 베이스라인과 같은 'platypus'인데, 내가 준 사진들의 그 특유한 모양·질감이 묻어나면 학습이 먹힌 거야.",
  // 21 — lora scale sweep on my LoRA
  "내가 학습한 LoRA의 세기를 0.0~1.4로 돌려가며 한 장씩 깔아. 0이면 베이스 모델, 1.0이면 학습 그대로, 그 위는 과적용. 9-1에서 본 다이얼을 이번엔 '내 손으로 만든 LoRA'에 적용해보는 거야 — 어느 세기가 제일 그럴듯한지 눈으로 골라.",
  // 22 — list adapters
  "지금 파이프라인에 어떤 LoRA 어댑터들이 붙어 있는지 목록을 찍어봐. 여러 LoRA를 갈아끼우거나 섞기 전에 현재 상태를 확인하는 한 줄이야.",
  // 23 — delete adapter
  "기본으로 붙어 있던 어댑터(default_0)를 떼어내. 다음 셀에서 '학습 단계별 체크포인트'를 하나씩 새로 끼웠다 뺐다 하며 비교할 거라, 자리를 깨끗이 비우는 거야.",
  // 24 — compare training steps
  {
    text: "학습이 진행될수록 LoRA가 얼마나 좋아지는지 비교해. 1000·2000·3000·4000·5000스텝 체크포인트를 하나씩 끼워 같은 시드로 platypus를 뽑고, 다 쓰면 바로 떼어내(delete_adapters) 다음 걸 깨끗이 끼워. 한 줄에 5장을 깔면 '스텝이 늘수록 형태가 또렷해지는' 학습 곡선을 그림으로 보는 셈이야 — 단, 너무 오래 굽으면 과적합으로 다양성이 줄기도 해.",
    diagram: {
      title: "학습 스텝별 LoRA 비교",
      kind: "algorithm",
      summary: `flowchart TD
  A["steps in [1000…5000]"] --> B["load_lora_weights(ckpt_steps, name='platypus')"]
  B --> C["같은 시드로 platypus 생성"]
  C --> D["delete_adapters('platypus')"]
  D --> E{"다음 체크포인트 ?"}
  E -->|예| A
  E -->|아니오| F["5장 격자로 비교"]`,
    },
  },
  // 25 — load 2000-step LoRA for style mixing
  "스타일 조합 실험용으로, 적당히 잘 익은 2000스텝 체크포인트를 'platypus'라는 이름으로 다시 얹어. 다음 셀에서 이 LoRA를 켜둔 채로 온갖 화풍 프롬프트를 먹여볼 거야.",
  // 26 — style mixing showcase
  "내 platypus LoRA를 켜둔 채(scale=0.9) 사이버펑크·스팀펑크·수채화·픽셀아트 등 10가지 화풍 프롬프트를 먹여 한 줄에 쭉 깔아. 핵심은 'LoRA가 platypus라는 대상(주제)은 고정해주고, 프롬프트가 화풍을 갈아끼운다'는 분리야 — 이게 실무에서 LoRA가 강력한 이유야. 캐릭터·제품·로고를 LoRA로 학습해두면, 프롬프트만 바꿔 같은 대상의 무한한 변주(광고 컷·일러스트·썸네일)를 찍어낼 수 있거든.",
];

export default explanations;
