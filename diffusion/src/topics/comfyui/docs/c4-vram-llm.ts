import type { StudyDoc } from "@/models/study";

// 사실 근거: comfyui-custom-node-guide.md §4 (GPU 비우기) + §1 노드 규칙.
// 검증 API: comfy.model_management.unload_all_models / soft_empty_cache,
//           torch.cuda.empty_cache, gc.collect, requests.post(llama.cpp).
// 레퍼런스: SeanScripts/ComfyUI-Unload-Model, ControlFlowUtils → Unload Models.

const doc: StudyDoc = {
  id: "c4-vram-llm",
  title: "GPU 정리 & 외부 LLM",
  cells: [
    {
      type: "markdown",
      source:
        "## 개념 — VRAM은 한 장, 손님은 둘\n무거운 파이프라인은 GPU 메모리(VRAM)가 늘 빡빡해. 디퓨전 모델(U-Net·VAE)이 이미 자리를 잡고 있는데, 거기에 LLM까지 끼면 터지지. 핵심 한 줄: **출력이 끝난 모델은 언로드해서 다음 단계에 자리를 내준다.**\n\nComfyUI는 모델을 알아서 GPU에 올렸다 내렸다 관리해(`comfy.model_management`, 줄여서 `mm`). 우리가 할 일은 \"이제 이 디퓨전 모델 안 써, 비워\"라고 명시적으로 신호를 주는 것 뿐이야. LLM은 아예 **다른 프로세스**(llama.cpp API 서버)에 맡겨서 ComfyUI의 VRAM 회계와 분리해.",
    },
    {
      type: "markdown",
      source:
        "## 코드 — cleanup_vram() 헬퍼\n자리를 비우는 네 단계. 순서가 의미 있어: 먼저 Comfy가 관리하는 모델을 **언로드**(GPU→CPU/디스크)하고, Comfy 캐시를 정리한 뒤, 파이썬 가비지를 수거하고, 마지막으로 파이토치가 쥐고 있던 캐시 블록을 드라이버에 **반환**해. 앞 셋을 안 하고 `empty_cache()`만 부르면 — 아직 참조가 살아있어서 — 거의 안 비워져.",
    },
    {
      type: "code",
      source: `import comfy.model_management as mm
import gc
import torch


def cleanup_vram(unload_models: bool = True) -> None:
    """디퓨전 모델을 내려 다음 단계(LLM·다음 노드)에 VRAM을 양보한다."""
    if unload_models:
        mm.unload_all_models()      # ① Comfy가 관리하는 모델들 언로드
    mm.soft_empty_cache()           # ② Comfy 내부 캐시 정리
    gc.collect()                    # ③ 파이썬 객체 가비지 수거
    if torch.cuda.is_available():
        torch.cuda.empty_cache()    # ④ 파이토치 캐시 블록을 드라이버에 반환`,
    },
    {
      type: "markdown",
      source:
        "## 코드 — llama.cpp 프롬프트 생성 노드\n이제 외부 LLM을 붙여. llama.cpp를 `--server`로 띄워두면 OpenAI 호환 `/v1/chat/completions` 엔드포인트가 열려. 노드는 **HTTP 호출만** 해(`requests.post`) — LLM의 VRAM은 그 서버 프로세스가 들고 있으니 ComfyUI는 1바이트도 안 써. 응답 텍스트를 받으면, 다음 디퓨전 단계를 위해 `cleanup_vram()`으로 **디퓨전 쪽** 자리를 비워.\n\n중간 노드라 `OUTPUT_NODE`가 아니고, STRING 하나만 반환해. 매번 새 프롬프트를 받으려면 `IS_CHANGED → NaN`으로 캐시를 끈다(NaN은 자기 자신과도 같지 않아서 항상 '바뀜'으로 친다).",
    },
    {
      type: "code",
      source: `import requests


class LlamaCppPrompt:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "server_url": ("STRING", {"default": "http://127.0.0.1:8080"}),
                "instruction": ("STRING", {"multiline": True,
                    "default": "Describe a pixel-art sprite of a knight."}),
                "max_tokens": ("INT", {"default": 128, "min": 16, "max": 1024}),
                "free_vram_after": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate"
    CATEGORY = "sprite/llm"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")          # 매 큐마다 새로 호출(캐시 끔)

    def generate(self, server_url, instruction, max_tokens, free_vram_after):
        # llama.cpp 서버는 OpenAI 호환 — HTTP 호출만, LLM VRAM은 그 서버가 보유
        resp = requests.post(
            f"{server_url}/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": instruction}],
                "max_tokens": max_tokens,
                "temperature": 0.8,
            },
            timeout=120,
        )
        resp.raise_for_status()
        prompt = resp.json()["choices"][0]["message"]["content"].strip()

        if free_vram_after:
            cleanup_vram()           # 디퓨전 모델 언로드 → 다음 i2i 단계에 양보
        return (prompt,)`,
    },
    {
      type: "markdown",
      source:
        "## 응용 — 어디에 끼우나\n파이프라인 순서는 `[LLM 프롬프트] → cleanup → [생성/i2i]`야. LLM이 텍스트를 뱉는 순간엔 디퓨전 모델이 필요 없으니 비우고, 곧바로 KSampler가 VRAM을 풀로 쓰게 해.\n\n주의: `cleanup_vram()`은 **디퓨전 모델**을 내릴 뿐, llama 서버 자체는 안 내려(다른 프로세스니까). 서버를 내리려면 그 서버에 unload 엔드포인트가 있을 때만 가능해. 노드 안에서 `llama_cpp`를 **직접 로드**한 경우엔 얘기가 달라 — 그땐 `del llm; gc.collect(); torch.cuda.empty_cache()`로 직접 푼다. 실전에선 서버 방식이 VRAM 회계가 깔끔해서 권장. 레퍼런스로 `SeanScripts/ComfyUI-Unload-Model`, `ControlFlowUtils`의 Unload Models 노드를 그대로 베껴 배우면 빠르다.",
    },
  ],
};

export default doc;
