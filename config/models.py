"""Comprehensive model configuration for OpenRouter models"""

from typing import Dict, List, Any
from dataclasses import dataclass

@dataclass
class ModelInfo:
    """Model metadata and configuration"""
    id: str
    name: str
    category: str
    max_tokens: int
    temperature_default: float = 0.7
    supports_web_search: bool = True
    is_free: bool = False
    notes: str = ""

# Comprehensive model registry
MODEL_REGISTRY: Dict[str, ModelInfo] = {
    # Production models (from research paper)
    "google/gemini-2.5-pro-preview": ModelInfo(
        id="google/gemini-2.5-pro-preview",
        name="Gemini 2.5 Pro Preview",
        category="flagship",
        max_tokens=8000,
        temperature_default=0.7,
        notes="Primary research model - use preview endpoint"
    ),
    "openai/gpt-5-chat": ModelInfo(
        id="openai/gpt-5-chat",
        name="GPT-5 Chat",
        category="flagship",
        max_tokens=4000,
        temperature_default=0.7,
        notes="Use gpt-5-chat not gpt-5"
    ),
    "anthropic/claude-opus-4.1": ModelInfo(
        id="anthropic/claude-opus-4.1",
        name="Claude Opus 4.1",
        category="flagship",
        max_tokens=4000,
        temperature_default=0.7,
        notes="Latest Claude Opus version"
    ),
    "x-ai/grok-4": ModelInfo(
        id="x-ai/grok-4",
        name="Grok 4",
        category="flagship",
        max_tokens=8000,
        temperature_default=0.7,
        notes="Latest Grok flagship model"
    ),
    "deepseek/deepseek-chat-v3.1": ModelInfo(
        id="deepseek/deepseek-chat-v3.1",
        name="DeepSeek Chat V3.1",
        category="flagship",
        max_tokens=8000,
        temperature_default=0.7,
        notes="Latest DeepSeek chat model"
    ),

    # Free tier models (verified from OpenRouter API)
    "tngtech/deepseek-r1t2-chimera:free": ModelInfo(
        id="tngtech/deepseek-r1t2-chimera:free",
        name="TNG DeepSeek R1T2 Chimera",
        category="reasoning",
        max_tokens=16384,
        is_free=True,
        notes="Free reasoning model with enhanced capabilities"
    ),
    "tngtech/deepseek-r1t-chimera:free": ModelInfo(
        id="tngtech/deepseek-r1t-chimera:free",
        name="TNG DeepSeek R1T Chimera",
        category="reasoning",
        max_tokens=16384,
        is_free=True,
        notes="Free reasoning model"
    ),
    "x-ai/grok-4-fast:free": ModelInfo(
        id="x-ai/grok-4-fast:free",
        name="Grok 4 Fast",
        category="flagship",
        max_tokens=8000,
        is_free=True,
        notes="Fast free version of Grok 4"
    ),
    "nvidia/nemotron-nano-9b-v2:free": ModelInfo(
        id="nvidia/nemotron-nano-9b-v2:free",
        name="NVIDIA Nemotron Nano 9B V2",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Efficient NVIDIA model"
    ),
    "openai/gpt-oss-120b:free": ModelInfo(
        id="openai/gpt-oss-120b:free",
        name="OpenAI GPT-OSS 120B",
        category="flagship",
        max_tokens=4000,
        is_free=True,
        notes="Large open-source GPT model"
    ),
    "openai/gpt-oss-20b:free": ModelInfo(
        id="openai/gpt-oss-20b:free",
        name="OpenAI GPT-OSS 20B",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Smaller open-source GPT model"
    ),
    "z-ai/glm-4.5-air:free": ModelInfo(
        id="z-ai/glm-4.5-air:free",
        name="Z.AI GLM 4.5 Air",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Chinese multilingual model"
    ),
    "qwen/qwen3-coder:free": ModelInfo(
        id="qwen/qwen3-coder:free",
        name="Qwen3 Coder 480B A35B",
        category="coding",
        max_tokens=8000,
        is_free=True,
        notes="Large coding-optimized model"
    ),
    "moonshotai/kimi-k2:free": ModelInfo(
        id="moonshotai/kimi-k2:free",
        name="MoonshotAI Kimi K2 0711",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Chinese conversational model"
    ),

    # Free tier models from Image #2
    "nousresearch/deephermes-3-llama-3-8b-preview:free": ModelInfo(
        id="nousresearch/deephermes-3-llama-3-8b-preview:free",
        name="Nous DeepHermes 3 Llama 3 8B",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Fine-tuned Llama model"
    ),
    "deepseek/deepseek-chat-v3.1:free": ModelInfo(
        id="deepseek/deepseek-chat-v3.1:free",
        name="DeepSeek Chat V3.1",
        category="flagship",
        max_tokens=8000,
        is_free=True,
        notes="Latest free DeepSeek version"
    ),
    "deepseek/deepseek-r1-0528-qwen3-8b:free": ModelInfo(
        id="deepseek/deepseek-r1-0528-qwen3-8b:free",
        name="DeepSeek R1 Qwen3 8B",
        category="reasoning",
        max_tokens=6000,
        is_free=True,
        notes="DeepSeek reasoning with Qwen base"
    ),
    "deepseek/r1-0528:free": ModelInfo(
        id="deepseek/r1-0528:free",
        name="DeepSeek R1 0528",
        category="reasoning",
        max_tokens=6000,
        is_free=True,
        notes="DeepSeek R1 reasoning model"
    ),
    "deepseek/deepseek-chat-v3-0324:free": ModelInfo(
        id="deepseek/deepseek-chat-v3-0324:free",
        name="DeepSeek Chat V3 0324",
        category="general",
        max_tokens=6000,
        is_free=True,
        notes="Earlier V3 version"
    ),
    "deepseek/r1-distill-llama-70b:free": ModelInfo(
        id="deepseek/r1-distill-llama-70b:free",
        name="DeepSeek R1 Distill Llama 70B",
        category="reasoning",
        max_tokens=6000,
        is_free=True,
        notes="Large distilled reasoning model"
    ),
    "deepseek/r1:free": ModelInfo(
        id="deepseek/r1:free",
        name="DeepSeek R1",
        category="reasoning",
        max_tokens=6000,
        is_free=True,
        notes="Base R1 reasoning model"
    ),
    "agentica-org/deepcoder-14b-preview:free": ModelInfo(
        id="agentica-org/deepcoder-14b-preview:free",
        name="Agentica Deepcoder 14B Preview",
        category="coding",
        max_tokens=6000,
        is_free=True,
        notes="Code-focused model"
    ),
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free": ModelInfo(
        id="cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        name="Venice Uncensored (Dolphin Mistral 24B)",
        category="general",
        max_tokens=4000,
        is_free=True,
        notes="Uncensored conversational model"
    ),

    # Additional reasoning and flagship models (not free)
    "openai/o1-preview": ModelInfo(
        id="openai/o1-preview",
        name="OpenAI o1 Preview",
        category="reasoning",
        max_tokens=10000,
        temperature_default=1.0,
        notes="Advanced reasoning model"
    ),
    "openai/o1-mini": ModelInfo(
        id="openai/o1-mini",
        name="OpenAI o1 Mini",
        category="reasoning",
        max_tokens=6000,
        temperature_default=1.0,
        notes="Faster reasoning model"
    ),
    "qwen/qwq-32b-preview": ModelInfo(
        id="qwen/qwq-32b-preview",
        name="Qwen QwQ 32B",
        category="reasoning",
        max_tokens=8000,
        notes="Qwen reasoning model"
    ),

    # Legacy models for compatibility
    "google/gemini-2.0-flash-exp": ModelInfo(
        id="google/gemini-2.0-flash-exp",
        name="Gemini 2.0 Flash Experimental",
        category="general",
        max_tokens=8000,
        notes="Fast experimental Gemini model"
    ),
    "openai/gpt-4-turbo-preview": ModelInfo(
        id="openai/gpt-4-turbo-preview",
        name="GPT-4 Turbo Preview",
        category="general",
        max_tokens=4000,
        notes="GPT-4 Turbo version"
    ),
    "anthropic/claude-3-opus-20240229": ModelInfo(
        id="anthropic/claude-3-opus-20240229",
        name="Claude 3 Opus",
        category="general",
        max_tokens=4000,
        notes="Earlier Claude version"
    ),
}

# Model groups for easy selection
MODEL_GROUPS = {
    "research_paper": [
        "google/gemini-2.5-pro-preview",
        "openai/gpt-5-chat",
        "anthropic/claude-opus-4.1",
        "x-ai/grok-4",
        "deepseek/deepseek-chat-v3.1"
    ],
    "flagship_free": [
        "x-ai/grok-4-fast:free",
        "openai/gpt-oss-120b:free",
        "deepseek/deepseek-chat-v3.1:free",
        "google/gemini-2.0-flash-exp:free"
    ],
    "reasoning_free": [
        "tngtech/deepseek-r1t2-chimera:free",
        "tngtech/deepseek-r1t-chimera:free",
        "deepseek/r1-0528:free",
        "deepseek/r1-distill-llama-70b:free",
        "deepseek/r1:free",
        "microsoft/mai-ds-r1:free"
    ],
    "coding_free": [
        "qwen/qwen3-coder:free",
        "agentica-org/deepcoder-14b-preview:free",
        "qwen/qwen-2.5-coder-32b-instruct:free"
    ],
    "general_free": [
        "nvidia/nemotron-nano-9b-v2:free",
        "openai/gpt-oss-20b:free",
        "z-ai/glm-4.5-air:free",
        "moonshotai/kimi-k2:free",
        "nousresearch/deephermes-3-llama-3-8b-preview:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ],
    "all_free": [
        # All verified free models from OpenRouter API
        "tngtech/deepseek-r1t2-chimera:free",
        "tngtech/deepseek-r1t-chimera:free",
        "x-ai/grok-4-fast:free",
        "nvidia/nemotron-nano-9b-v2:free",
        "openai/gpt-oss-120b:free",
        "openai/gpt-oss-20b:free",
        "z-ai/glm-4.5-air:free",
        "qwen/qwen3-coder:free",
        "moonshotai/kimi-k2:free",
        "nousresearch/deephermes-3-llama-3-8b-preview:free",
        "deepseek/deepseek-chat-v3.1:free",
        "deepseek/deepseek-r1-0528-qwen3-8b:free",
        "deepseek/r1-0528:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "deepseek/r1-distill-llama-70b:free",
        "deepseek/r1:free",
        "agentica-org/deepcoder-14b-preview:free",
        "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "microsoft/mai-ds-r1:free"
    ]
}

def get_model_info(model_id: str) -> ModelInfo:
    """Get model information by ID"""
    return MODEL_REGISTRY.get(model_id, ModelInfo(
        id=model_id,
        name=model_id.split("/")[-1].replace("-", " ").title(),
        category="unknown",
        max_tokens=4000,
        notes="Unconfigured model - using defaults"
    ))

def get_models_by_category(category: str) -> List[str]:
    """Get all model IDs in a category"""
    return [
        model_id for model_id, info in MODEL_REGISTRY.items()
        if info.category == category
    ]

def get_free_models() -> List[str]:
    """Get all free model IDs"""
    return [
        model_id for model_id, info in MODEL_REGISTRY.items()
        if info.is_free
    ]

def validate_model_id(model_id: str) -> bool:
    """Check if a model ID is valid/known"""
    return model_id in MODEL_REGISTRY