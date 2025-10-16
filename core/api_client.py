"""OpenRouter API client wrapper for LLM interactions"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import aiohttp
from aiohttp import ClientTimeout, ClientError
import backoff

from config.settings import get_settings
from core.cache_manager import CacheManager

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """Async client for OpenRouter API interactions"""

    def __init__(self, api_key: Optional[str] = None, use_cache: bool = True):
        """
        Initialize OpenRouter client

        Args:
            api_key: OpenRouter API key (uses env if not provided)
            use_cache: Whether to use response caching (default: True)
        """
        settings = get_settings()
        self.settings = settings
        self.api_key = api_key or settings.api.api_key
        self.base_url = settings.api.base_url
        self.timeout = settings.api.timeout
        self.retry_attempts = settings.api.retry_attempts
        self.retry_delay = settings.api.retry_delay
        self.use_cache = use_cache
        self.referer = settings.api.referer
        self.title = settings.api.title

        # Initialize cache manager
        if self.use_cache:
            self.cache = CacheManager()
        else:
            self.cache = None

        self._base_endpoint = f"{self.base_url}/chat/completions"

    @backoff.on_exception(
        backoff.expo,
        (ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=60
    )
    async def query_model(
        self,
        model: str,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        enable_web_search: bool = True,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Query a specific model with retry logic and caching

        Args:
            model: Model identifier (e.g., 'openai/gpt-4')
            prompt: The prompt to send
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            enable_web_search: Enable web search for current information (default: True)
            force_refresh: Force API call even if cache exists (default: False)

        Returns:
            Response dictionary with model output and metadata
        """
        # Check cache first if enabled
        if self.cache and not force_refresh:
            cached_response = self.cache.get(model, prompt)
            if cached_response:
                logger.info(f"Using cached response for {model} (saving API credits)")
                cached_response['response_source'] = 'cache'
                return cached_response

        # Apply model-specific token requirements
        model_lower = model.lower()

        # Adjust token limits for specific free-tier models
        if 'gemini' in model_lower:
            max_tokens = max(max_tokens, 8000)  # Ensure Gemini Flash free tier has enough context
            logger.debug(f"Adjusting max_tokens for Gemini to {max_tokens}")
        elif 'llama' in model_lower:
            max_tokens = max(max_tokens, 4000)
            logger.debug(f"Adjusting max_tokens for Llama variant to {max_tokens}")
        elif 'deepseek' in model_lower:
            max_tokens = max(max_tokens, 4000)
            logger.debug(f"Adjusting max_tokens for DeepSeek variant to {max_tokens}")
        elif 'qwen' in model_lower:
            max_tokens = max(max_tokens, 4000)
            logger.debug(f"Adjusting max_tokens for Qwen variant to {max_tokens}")

        start_time = datetime.now()

        try:
            payload: Dict[str, Any] = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            if enable_web_search:
                payload["extra_body"] = {
                    "web_search": {
                        "engine": "native"
                    }
                }

            response = await self._post_completion(payload)

            if "error" in response:
                error_info = response["error"]
                message = error_info.get("message", "Unknown error")
                logger.error(f"OpenRouter returned error for {model}: {message}")
                return {
                    "model": model,
                    "timestamp": start_time.isoformat(),
                    "response_time": (datetime.now() - start_time).total_seconds(),
                    "content": None,
                    "probability": None,
                    "log_probabilities": None,
                    "usage": {
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_tokens": 0
                    },
                    "error": message,
                    "status": "error",
                    "response_source": "api"
                }

            # Calculate response time
            response_time = (datetime.now() - start_time).total_seconds()

            choices = response.get("choices", [])
            content = ""
            if choices:
                content = choices[0].get("message", {}).get("content", "") or ""

            # Check if the model rejected the prompt (safety filter)
            rejection_patterns = [
                "cannot ignore my safety instructions",
                "must decline this request",
                "attempt to override",
                "cannot comply with",
                "against my programming",
                "violates my guidelines"
            ]

            content_lower = content.lower() if content else ""
            is_rejected = any(pattern in content_lower for pattern in rejection_patterns)

            if is_rejected:
                logger.warning(f"Model {model} appears to have rejected the prompt due to safety filters")
                logger.debug(f"Rejection response snippet: {content[:200]}")

            # Parse the response for PROGNOSE value
            probability = self._extract_probability(content)

            # Log extraction failure for debugging
            if probability is None and not is_rejected:
                logger.debug(f"Could not extract probability from {model} response")
                logger.debug(f"Response snippet (last 200 chars): {content[-200:] if content else 'Empty response'}")

            # Final validation to ensure probability is within bounds
            if probability is not None and (probability < 0 or probability > 100):
                logger.warning(f"Extracted probability {probability} is out of bounds, setting to None")
                probability = None

            # Extract log probabilities if available
            log_probs = None
            if choices:
                log_probs = choices[0].get("logprobs")
                if log_probs is not None:
                    log_probs = json.dumps(log_probs)

            result = {
                "model": model,
                "timestamp": start_time.isoformat(),
                "response_time": response_time,
                "content": content,
                "probability": probability,
                "log_probabilities": log_probs,
                "usage": {
                    "prompt_tokens": response.get("usage", {}).get("prompt_tokens", 0),
                    "completion_tokens": response.get("usage", {}).get("completion_tokens", 0),
                    "total_tokens": response.get("usage", {}).get("total_tokens", 0)
                },
                "status": "rejected" if is_rejected else "success",
                "response_source": "api"
            }

            # Cache the successful response
            if self.cache and result["status"] == "success":
                self.cache.set(model, prompt, result)
                logger.debug(f"Cached response for {model}")

            return result

        except asyncio.TimeoutError:
            logger.error(f"Timeout querying {model}")
            return {
                "model": model,
                "timestamp": start_time.isoformat(),
                "response_time": self.timeout,
                "content": None,
                "probability": None,
                "error": "Request timeout",
                "status": "timeout"
            }

        except Exception as e:
            logger.error(f"Error querying {model}: {str(e)}")
            return {
                "model": model,
                "timestamp": start_time.isoformat(),
                "response_time": (datetime.now() - start_time).total_seconds(),
                "content": None,
                "probability": None,
                "error": str(e),
                "status": "error"
            }

    async def batch_query(
        self,
        model: str,
        prompt: str,
        iterations: int = 10,
        concurrent_limit: int = 3,
        enable_web_search: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Query a model multiple times with concurrency control

        Args:
            model: Model identifier
            prompt: The prompt to send
            iterations: Number of times to query
            concurrent_limit: Maximum concurrent requests
            enable_web_search: Enable web search for current information (default: True)

        Returns:
            List of response dictionaries
        """
        semaphore = asyncio.Semaphore(concurrent_limit)

        async def limited_query(iteration: int):
            async with semaphore:
                logger.info(f"Querying {model} - Iteration {iteration + 1}/{iterations}")
                result = await self.query_model(model, prompt, enable_web_search=enable_web_search)
                result["iteration"] = iteration + 1
                return result

        tasks = [limited_query(i) for i in range(iterations)]
        results = await asyncio.gather(*tasks)

        return results

    def _extract_probability(self, content: str) -> Optional[float]:
        """
        Enhanced probability extraction supporting multiple languages and formats

        Args:
            content: Response text containing forecast/prognose section

        Returns:
            Probability as float (0-100) or None if not found
        """
        if not content:
            return None

        import re

        try:
            # PRIORITY 1: Look for enhanced structured format (HAUPTPROGNOSE:)
            # This is the new format from the ensemble-aware prompt
            hauptprognose_patterns = [
                r'HAUPTPROGNOSE:\s*(\d+(?:\.\d+)?)\s*%',  # Standard format
                r'\*\*HAUPTPROGNOSE:\s*(\d+(?:\.\d+)?)\s*%\*\*',  # Bold markdown
                r'HAUPTPROGNOSE:\s*\*\*(\d+(?:\.\d+)?)\s*%\*\*',  # Bold percentage only
                r'HAUPTPROGNOSE:\s*(\d+(?:\.\d+)?)',  # Without % sign
            ]

            for pattern in hauptprognose_patterns:
                hauptprognose_match = re.search(pattern, content, re.IGNORECASE)
                if hauptprognose_match:
                    value = float(hauptprognose_match.group(1))
                    if 0 <= value <= 100:
                        logger.debug(f"Found probability in HAUPTPROGNOSE section: {value}%")
                        return value

            # PRIORITY 2: Look specifically for PROGNOSE: section (legacy format)
            # This should be the final answer according to our original prompt format
            # Handle various formatting (bold, markdown, etc.)
            prognose_patterns = [
                r'PROGNOSE:\s*(\d+(?:\.\d+)?)\s*%',  # Standard format
                r'\*\*PROGNOSE:\s*(\d+(?:\.\d+)?)\s*%\*\*',  # Bold markdown
                r'PROGNOSE:\s*\*\*(\d+(?:\.\d+)?)\s*%\*\*',  # Bold percentage only
                r'PROGNOSE:\s*(\d+(?:\.\d+)?)',  # Without % sign
            ]

            for pattern in prognose_patterns:
                prognose_match = re.search(pattern, content, re.IGNORECASE)
                if prognose_match:
                    value = float(prognose_match.group(1))
                    if 0 <= value <= 100:
                        logger.debug(f"Found probability in PROGNOSE section: {value}%")
                        return value

            # PRIORITY 2: Look for Final_Probability calculation (from the formula)
            final_prob_patterns = [
                r'Final_Probability\s*=\s*(\d+(?:\.\d+)?)',
                r'Final_Probability\s*=.*?(\d+(?:\.\d+)?)\s*%',
                r'=\s*(\d+(?:\.\d+)?)\s*(?:%)?$'  # End of calculation
            ]

            for pattern in final_prob_patterns:
                matches = re.findall(pattern, content, re.MULTILINE | re.IGNORECASE)
                if matches:
                    value = float(matches[-1])  # Take the last match (final result)
                    if 0 <= value <= 100:
                        logger.debug(f"Found probability in calculation: {value}%")
                        return value

            # Make content case-insensitive for pattern matching
            content_lower = content.lower()

            # PRIORITY 3: Look for forecast section keywords
            forecast_patterns = [
                "prognose:",
                "forecast:",
                "prediction:",
                "probability:",
                "wahrscheinlichkeit:",
                "final probability:",
                "ensemble probability:",
                "result:",
                "answer:",
                "conclusion:"
            ]

            # Look for forecast section keywords
            for pattern in forecast_patterns:
                if pattern in content_lower:
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        line_lower = line.lower()
                        if pattern in line_lower:
                            # Check the same line first
                            if "%" in line:
                                prob_text = line.split(":")[-1].strip() if ":" in line else line.strip()
                            # Check the next few lines
                            elif i + 1 < len(lines) and "%" in lines[i + 1]:
                                prob_text = lines[i + 1].strip()
                            elif i + 2 < len(lines) and "%" in lines[i + 2]:
                                prob_text = lines[i + 2].strip()
                            else:
                                continue

                            # Extract percentage value with improved regex
                            percentage_match = re.search(r'(\d+(?:\.\d+)?)\s*%', prob_text)
                            if percentage_match:
                                value = float(percentage_match.group(1))
                                if 0 <= value <= 100:
                                    return value

                            # Try to extract number without % symbol
                            prob_text = prob_text.replace("%", "").strip()
                            # Handle ranges (e.g., "40-60" -> take midpoint)
                            if "-" in prob_text:
                                try:
                                    numbers = re.findall(r'\d+(?:\.\d+)?', prob_text)
                                    if len(numbers) >= 2:
                                        return (float(numbers[0]) + float(numbers[1])) / 2
                                except:
                                    pass

                            # Single value extraction
                            number_match = re.search(r'(\d+(?:\.\d+)?)', prob_text)
                            if number_match:
                                value = float(number_match.group(1))
                                # Only convert 0-1 to percentage if it looks like a decimal probability
                                # (e.g., 0.45 likely means 45%, but 0.45% means 0.45%)
                                if 0 < value <= 1 and "%" not in prob_text:
                                    # Check context - if % was already mentioned, don't multiply
                                    return value * 100
                                # If reasonable percentage range
                                elif 0 <= value <= 100:
                                    return value

            # Enhanced fallback: look for any percentage patterns in the content
            # Try multiple percentage patterns including GPT-5 specific formats
            percentage_patterns = [
                r'(\d+(?:\.\d+)?)\s*%',  # "45.2%"
                r'(\d+(?:\.\d+)?)\s*percent',  # "45.2 percent"
                r'probability\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?)\s*%',  # "probability: 45%"
                r'(\d+(?:\.\d+)?)\s*%\s*probability',  # "45% probability"
                r'final.*?(\d+(?:\.\d+)?)\s*%',  # "final answer: 45%"
                r'answer.*?(\d+(?:\.\d+)?)\s*%',  # "answer is 45%"
                r'final_probability.*?(\d+(?:\.\d+)?)\s*%',  # "Final_Probability = 45%"
                r'Final_Probability.*?(\d+(?:\.\d+)?)',  # GPT-5 format with formula result
                r'=\s*(\d+(?:\.\d+)?)\s*%',  # "= 45%" calculation result
                r'therefore.*?(\d+(?:\.\d+)?)\s*%',  # "Therefore, 45%"
                r'conclusion.*?(\d+(?:\.\d+)?)\s*%',  # "In conclusion, 45%"
                r'estimate.*?(\d+(?:\.\d+)?)\s*%',  # "I estimate 45%"
                r'assess.*?(\d+(?:\.\d+)?)\s*%',  # "I assess 45%"
                r'likely.*?(\d+(?:\.\d+)?)\s*%',  # "likely 45%"
                r'around\s*(\d+(?:\.\d+)?)\s*%',  # "around 45%"
                r'approximately\s*(\d+(?:\.\d+)?)\s*%',  # "approximately 45%"
                r'roughly\s*(\d+(?:\.\d+)?)\s*%',  # "roughly 45%"
                r'my\s+(?:final\s+)?(?:forecast|prediction|estimate)\s+is\s+(\d+(?:\.\d+)?)\s*%',  # "my forecast is X%"
                r'i\s+(?:would\s+)?(?:forecast|predict|estimate)\s+(\d+(?:\.\d+)?)\s*%',  # "I forecast X%"
            ]

            for pattern in percentage_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    # Return the last match (likely the final answer)
                    return float(matches[-1])

            # Special handling for Super-Forecaster formula calculations
            # Look for the specific formula result pattern from the prompt
            formula_patterns = [
                r'Final_Probability\s*=.*?(\d+(?:\.\d+)?)',  # Formula calculation
                r'\(\s*\d+(?:\.\d+)?\s*×.*?\)\s*/\s*100\s*=\s*(\d+(?:\.\d+)?)',  # Division result
                r'=\s*(\d+(?:\.\d+)?)\s*(?:%)?$',  # End of line calculation result
                r'Antwort:\s*(\d+(?:\.\d+)?)\s*%',  # German "Answer:"
                r'Ergebnis:\s*(\d+(?:\.\d+)?)\s*%',  # German "Result:"
            ]

            for pattern in formula_patterns:
                matches = re.findall(pattern, content, re.MULTILINE | re.IGNORECASE)
                if matches:
                    try:
                        value = float(matches[-1])
                        if 0 <= value <= 100:
                            return value
                    except:
                        continue

            # Last resort: look for standalone numbers that might be probabilities
            # Look for numbers in reasonable probability range near end of text
            end_content = content[-500:]  # Last 500 characters
            number_matches = re.findall(r'\b(\d+(?:\.\d+)?)\b', end_content)
            for match in reversed(number_matches):  # Check from end backwards
                value = float(match)
                if 0 <= value <= 100:  # Reasonable probability range
                    return value

        except Exception as e:
            logger.warning(f"Could not extract probability: {e}")

        return None

    def _extract_enhanced_response_data(self, content: str) -> Dict[str, Any]:
        """
        Extract structured information from ensemble-aware responses

        Args:
            content: Response text containing enhanced structured output

        Returns:
            Dictionary containing extracted structured data
        """
        if not content:
            return {}

        import re

        extracted_data = {}

        try:
            # Extract confidence range
            confidence_pattern = r'KONFIDENZBEREICH:\s*(\d+(?:\.\d+)?%?)\s*[±±]\s*(\d+(?:\.\d+)?%?)'
            conf_match = re.search(confidence_pattern, content, re.IGNORECASE)
            if conf_match:
                base = float(conf_match.group(1).replace('%', ''))
                margin = float(conf_match.group(2).replace('%', ''))
                extracted_data['confidence_range'] = {
                    'center': base,
                    'margin': margin,
                    'lower': base - margin,
                    'upper': base + margin
                }

            # Extract scenarios
            scenarios = {}
            scenario_patterns = [
                (r'Optimistisches Szenario:\s*(\d+(?:\.\d+)?%?)', 'optimistic'),
                (r'Pessimistisches Szenario:\s*(\d+(?:\.\d+)?%?)', 'pessimistic'),
                (r'Outlier-Szenario:\s*(\d+(?:\.\d+)?%?)', 'outlier')
            ]

            for pattern, scenario_type in scenario_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    value = float(match.group(1).replace('%', ''))
                    scenarios[scenario_type] = value

            if scenarios:
                extracted_data['scenarios'] = scenarios

            # Extract quality indicators
            quality_patterns = [
                (r'Informationsvollständigkeit:\s*(\d+)/10', 'information_completeness'),
                (r'Analytische Rigorosität:\s*(\d+)/10', 'analytical_rigor'),
                (r'Bias-Resistenz:\s*(\d+)/10', 'bias_resistance'),
                (r'Prognostische Konsistenz:\s*(\d+)/10', 'forecasting_consistency')
            ]

            quality_indicators = {}
            for pattern, indicator_type in quality_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    value = int(match.group(1))
                    quality_indicators[indicator_type] = value

            if quality_indicators:
                extracted_data['quality_indicators'] = quality_indicators

            # Extract critical uncertainty factors
            uncertainty_pattern = r'KRITISCHE_UNSICHERHEITSFAKTOREN:\s*\[(.*?)\]'
            uncertainty_match = re.search(uncertainty_pattern, content, re.IGNORECASE | re.DOTALL)
            if uncertainty_match:
                factors_text = uncertainty_match.group(1)
                # Simple extraction of listed factors
                factors = [factor.strip() for factor in factors_text.split(',') if factor.strip()]
                extracted_data['uncertainty_factors'] = factors

            # Calculate overall quality score
            if 'quality_indicators' in extracted_data:
                quality_scores = list(extracted_data['quality_indicators'].values())
                extracted_data['overall_quality_score'] = sum(quality_scores) / len(quality_scores)

            logger.debug(f"Extracted enhanced data: {list(extracted_data.keys())}")
            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting enhanced response data: {e}")
            return {}

    async def test_connection(self) -> bool:
        """
        Test the API connection

        Returns:
            True if connection successful
        """
        try:
            # Use primary enabled model for connectivity test to avoid unauthorized model errors
            primary_model = get_settings().models.enabled_models[0]

            # Try a simple query to test the connection
            response = await self.query_model(
                model=primary_model,
                prompt="Say 'test successful' if you can read this.",
                max_tokens=10,
                enable_web_search=False  # No need for web search on connection test
            )
            return response.get("status") == "success"
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    async def get_available_models(self) -> List[str]:
        """
        Get list of available models from OpenRouter

        Returns:
            List of model identifiers
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return [model["id"] for model in data.get("data", [])]
        except Exception as e:
            logger.error(f"Failed to fetch models: {e}")

        # Return default list if API call fails
        return [
            "google/gemini-2.0-flash-exp",
            "openai/gpt-oss-20b",
            "meta-llama/llama-3.3-70b-instruct",
            "x-ai/grok-4-fast",
            "deepseek/deepseek-chat-v3.1",
            "qwen/qwen-2.5-72b-instruct"
        ]

    async def _post_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Call OpenRouter chat completion endpoint via curl (HTTP/2)."""
        curl_cmd = [
            "curl",
            "-sS",
            "--http1.1",
            "-X",
            "POST",
            self._base_endpoint,
            "-H",
            f"Authorization: Bearer {self.api_key}",
            "-H",
            "Content-Type: application/json",
            "-H",
            f"HTTP-Referer: {self.referer}",
            "-H",
            f"X-Title: {self.title}",
            "--data-binary",
            "@-"
        ]

        process = await asyncio.create_subprocess_exec(
            *curl_cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate(json.dumps(payload).encode("utf-8"))

        if process.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="ignore").strip()
            raise RuntimeError(f"curl request failed (code {process.returncode}): {error_msg}")

        try:
            return json.loads(stdout.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse OpenRouter response: {exc}: {stdout[:200]}") from exc
