# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Purpose

This is an AI-powered probabilistic forecasting system implementing "Wisdom of the Silicon Crowd" methodology for geopolitical forecasting. It uses ensemble forecasting across multiple LLMs via OpenRouter API to generate calibrated probability estimates with German Super-Forecaster prompts.

## Common Development Commands

### Running the Forecaster
```bash
# Interactive mode (recommended for development)
python main.py

# Run Ukraine ceasefire 2026 forecast (research replication)
python main.py --mode ukraine

# Run forecast for specific date in 2026 (flexible date handling)
python main.py --mode ukraine --by-date 2026-03-31  # Q1 deadline
python main.py --mode ukraine --by-date 2026-06-30  # Q2 deadline
python main.py --mode ukraine --by-date 2026-09-30  # Q3 deadline

# Custom forecast with single iteration for testing
python main.py --mode custom --question "Test question" --definition "Test definition" --iterations 1
```

### Testing & Validation
```bash
# Test model endpoints connectivity
python3 -c "
import asyncio
from core.api_client import OpenRouterClient
from config.settings import get_settings

async def test():
    client = OpenRouterClient()
    return await client.test_connection()

print('Connection:', asyncio.run(test()))
"

# Quick validation run (1 iteration per model)
python main.py --mode ukraine --iterations 1
```

### Dependency Management
```bash
# Install all dependencies
pip install -r requirements.txt

# For development with enhanced visualizations
pip install rich matplotlib seaborn plotly
```

## Architecture Overview

### Critical Flow Architecture

1. **Prompt Generation Pipeline**: `config/prompts.py` → German Super-Forecaster prompt with 12-step Chain-of-Thought methodology including Base Rate analysis (40 reference cases), Case Rate estimation, Confidence weighting, and Final_Probability calculation formula.

2. **API Request Flow**: `main.py` → `core/ensemble_manager.py` → `core/api_client.py` → OpenRouter API with web search enabled (`enable_web_search=True` with `"engine": "native"`).

3. **Probability Extraction Challenge**: `core/api_client.py::_extract_probability()` uses multilingual regex patterns to extract probabilities from German/English responses. GPT-5 often requires special formula parsing patterns.

4. **Aggregation Strategy**: All responses → `analysis/aggregator.py` → Statistical ensemble (mean, median, std) → `export/excel_exporter.py` → Multi-sheet Excel with charts.

### Model Configuration Requirements

**CRITICAL**: User's German research paper specifies exact models. Current production configuration in `.env`:
```
ENABLED_MODELS=google/gemini-2.5-pro-preview,openai/gpt-5-chat,anthropic/claude-opus-4.1,x-ai/grok-4,deepseek/deepseek-chat-v3.1
```

Common model endpoint issues:
- Gemini: Must use `gemini-2.5-pro-preview` not `gemini-2.5-pro`
- Claude: Must use `claude-opus-4.1` not `claude-sonnet-4`
- DeepSeek: Must use `deepseek-chat-v3.1` not `deepseek-r1` or `deepseek-v3-0324`
- GPT-5: Must use `gpt-5-chat` not `gpt-5` (gpt-5 returns empty responses)

### Web Search Integration

All models MUST have web search enabled for current information:
- Implemented in `core/api_client.py::query_model()` with `enable_web_search=True`
- Adds `extra_body: {"web_search": {"engine": "native"}}` to API requests
- Critical for Ukraine conflict analysis requiring 2025 current events

### Probability Extraction Patterns

The `_extract_probability()` function handles multiple response formats:
- German: "PROGNOSE: X%", "Wahrscheinlichkeit: X%"
- English: "FORECAST: X%", "Final_Probability = X"
- Formula results: Looks for calculation outputs from the 12-step methodology
- GPT-5 specific: Often uses different formatting, requires enhanced patterns

### Key Environment Variables

```bash
OPENROUTER_API_KEY=your_key_here  # Required - get from openrouter.ai
ITERATIONS_PER_MODEL=5            # Default: 10 for research, 5 for testing
CONCURRENT_REQUESTS=3             # Rate limiting
REQUEST_TIMEOUT=120               # Seconds before timeout
```

## Common Issues & Solutions

### Model Not Found Errors
Check exact OpenRouter model identifiers - they change frequently. Use `client.get_available_models()` to verify.

### Low Probability Extraction Rate
Models may not follow prompt format exactly. Check `foresight.log` for raw responses and add new regex patterns to `_extract_probability()`.

### Gemini Returning Unrealistic Values
Ensure using correct endpoint (`gemini-2.5-pro-preview`) and web search is enabled.

### Excel Export Issues
Large responses may exceed Excel cell limits. Check `export/excel_exporter.py` for truncation logic.

## Research Context

This implements Schoenegger et al. (2024) methodology with German prompts for Ukraine ceasefire 2026 forecasting. The 12-step Super-Forecaster process is critical - do not simplify the prompt structure.

## Output Structure

Results saved to `data/results/foresight_analysis_YYYYMMDD_HHMMSS.xlsx` with:
- Summary sheet: Ensemble probability, model comparison
- Raw_Responses: All individual model responses
- Statistics: Per-model and ensemble statistics
- Model_Comparison: Visual charts and consensus analysis
- Metadata: Configuration and prompt used