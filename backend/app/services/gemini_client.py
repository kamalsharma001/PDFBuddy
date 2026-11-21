import asyncio
import logging
import random
from typing import Any, Dict, List

import httpx

from ..config import get_settings

logger = logging.getLogger("pdfbuddy.gemini")


class GeminiClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def get_chat_models(self) -> List[str]:
        """Returns the primary and fallback Gemini chat models in prioritized order."""
        primary = (self.settings.gemini_chat_model or "gemini-3.8-flash").strip()
        models = [primary]
        if self.settings.gemini_fallback_models:
            for m in self.settings.gemini_fallback_models.split(","):
                cleaned = m.strip()
                if cleaned and cleaned not in models:
                    models.append(cleaned)
        return models

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        model = (self.settings.gemini_embedding_model or "gemini-embedding-001").strip()
        dim = self.settings.gemini_embedding_dim or 768

        async with httpx.AsyncClient(timeout=60.0) as client:
            embeddings: List[List[float]] = []
            for text in texts:
                max_retries = 2
                for attempt in range(max_retries):
                    try:
                        response = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
                            params={"key": self.settings.gemini_api_key},
                            json={
                                "model": f"models/{model}",
                                "content": {"parts": [{"text": text}]},
                                "outputDimensionality": dim,
                            },
                        )
                        response.raise_for_status()
                        break
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                            delay = (1.0 * (2 ** attempt)) + random.uniform(0.1, 0.4)
                            await asyncio.sleep(delay)
                            continue
                        raise
                    except httpx.RequestError as e:
                        if attempt < max_retries - 1:
                            delay = (1.0 * (2 ** attempt)) + random.uniform(0.1, 0.4)
                            await asyncio.sleep(delay)
                            continue
                        raise
                payload = response.json()
                embeddings.append(payload["embedding"]["values"])
        return embeddings

    async def answer_question(
        self,
        question: str,
        context_chunks: List[Any],
        previous_messages: List[dict[str, str]],
    ) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        formatted_blocks = []
        for index, item in enumerate(context_chunks):
            if isinstance(item, dict):
                p_num = item.get("page_number", index + 1)
                text = item.get("chunk_text", "")
                formatted_blocks.append(f"[Page {p_num}]:\n{text}")
            else:
                formatted_blocks.append(f"Chunk {index + 1}:\n{item}")

        context = "\n\n".join(formatted_blocks)
        history = "\n".join(
            f"{message['role']}: {message['content']}" for message in previous_messages[-8:]
        )
        prompt = (
            "You are PDFBuddy, a professional AI document intelligence assistant. Answer only from the provided PDF context. "
            "If the answer is not present, say that the PDF does not contain enough information to answer.\n"
            "CITATION REQUIREMENT: When referencing specific facts, numbers, metrics, or sections, cite the page number "
            "using the exact format [Page X] (e.g. [Page 3]). Only cite page numbers explicitly present in the context headers.\n\n"
            f"Conversation so far:\n{history or 'No previous messages.'}\n\n"
            f"Relevant PDF context:\n{context or 'No context was found.'}\n\n"
            f"User question: {question}"
        )
        models = self.get_chat_models()
        
        response = None
        last_error = None
        last_status_code = None
        success = False

        async with httpx.AsyncClient(timeout=45.0) as client:
            for idx, model_name in enumerate(models):
                max_retries = 2  # 1 initial try + 1 retry for transient capacity errors
                for attempt in range(max_retries):
                    try:
                        logger.info(
                            "Attempting Gemini inference with model: %s (attempt %s/%s)",
                            model_name,
                            attempt + 1,
                            max_retries,
                        )
                        response = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
                            params={"key": self.settings.gemini_api_key},
                            json={"contents": [{"parts": [{"text": prompt}]}]},
                        )
                        response.raise_for_status()
                        success = True
                        break
                    except httpx.HTTPStatusError as e:
                        last_error = e
                        last_status_code = e.response.status_code

                        # Permanent authentication or permission errors: abort immediately across all models
                        if last_status_code in (401, 403):
                            logger.error(
                                "Permanent authentication/permission error (%s) with Gemini API. Aborting.",
                                last_status_code,
                            )
                            return "Authentication with the AI service failed. Please verify the configured API key."

                        # Permanent malformed request errors: abort immediately
                        if last_status_code == 400:
                            logger.error("Gemini API rejected request with 400 Bad Request. Aborting.")
                            return "The document query could not be processed by the AI service."

                        # Model not found or deprecated (404): skip directly to next fallback model without retrying this model
                        if last_status_code == 404:
                            logger.warning(
                                "Gemini model %s returned 404 Not Found. Skipping to next fallback model.",
                                model_name,
                            )
                            break

                        # Rate-limit or Quota exhaustion (429)
                        if last_status_code == 429:
                            is_quota_exhausted = False
                            try:
                                err_text = e.response.text.lower()
                                if "resource_exhausted" in err_text or "quota" in err_text:
                                    is_quota_exhausted = True
                            except Exception:
                                pass

                            if is_quota_exhausted:
                                logger.warning(
                                    "Gemini model %s quota is exhausted. Failing over immediately to next model without retrying.",
                                    model_name,
                                )
                                break

                            # Check for Retry-After header
                            retry_hdr = e.response.headers.get("retry-after") or e.response.headers.get("Retry-After")
                            retry_seconds = None
                            if retry_hdr:
                                try:
                                    retry_seconds = float(retry_hdr)
                                except (ValueError, TypeError):
                                    pass

                            # If Retry-After asks to wait longer than 5s, fail over immediately to prevent stalling user
                            if retry_seconds is not None and retry_seconds > 5.0:
                                logger.warning(
                                    "Gemini model %s requested Retry-After %.1fs. Failing over immediately to avoid blocking.",
                                    model_name,
                                    retry_seconds,
                                )
                                break

                            if attempt < max_retries - 1:
                                delay = (retry_seconds if retry_seconds is not None else (1.0 * (2 ** attempt))) + random.uniform(0.1, 0.4)
                                logger.warning(
                                    "Gemini model %s returned transient 429. Retrying sequentially in %.2fs (attempt %s/%s)...",
                                    model_name,
                                    delay,
                                    attempt + 1,
                                    max_retries,
                                )
                                await asyncio.sleep(delay)
                                continue
                            break

                        # Transient capacity / server errors (500, 502, 503, 504): retry with exponential backoff + jitter
                        if last_status_code in (500, 502, 503, 504) and attempt < max_retries - 1:
                            delay = (1.0 * (2 ** attempt)) + random.uniform(0.1, 0.4)
                            logger.warning(
                                "Gemini model %s returned transient %s. Retrying in %.2fs with backoff (attempt %s/%s)...",
                                model_name,
                                last_status_code,
                                delay,
                                attempt + 1,
                                max_retries,
                            )
                            await asyncio.sleep(delay)
                            continue

                        # Retries exhausted for this model: fall over to next model in chain
                        next_model = models[idx + 1] if idx + 1 < len(models) else None
                        if next_model:
                            logger.info(
                                "Failing over from Gemini model %s to fallback model %s due to status %s",
                                model_name,
                                next_model,
                                last_status_code,
                            )
                        break

                    except httpx.RequestError as e:
                        last_error = e
                        if attempt < max_retries - 1:
                            delay = (1.0 * (2 ** attempt)) + random.uniform(0.1, 0.4)
                            logger.warning(
                                "Network error calling Gemini model %s. Retrying in %.2fs...",
                                model_name,
                                delay,
                            )
                            await asyncio.sleep(delay)
                            continue
                        next_model = models[idx + 1] if idx + 1 < len(models) else None
                        if next_model:
                            logger.info(
                                "Failing over from Gemini model %s to fallback model %s due to network error",
                                model_name,
                                next_model,
                            )
                        break

                if success:
                    break

        if not success:
            logger.error("All Gemini models in fallback chain failed. Last status: %s", last_status_code)
            if last_status_code == 429:
                return "The AI service is currently rate-limited due to high traffic. Please try again shortly."
            if last_status_code in (500, 502, 503, 504):
                return "The AI model is temporarily experiencing high demand across all available models. Please try again in a few moments."
            return "Unable to connect to the AI model service. Please check your network connection and try again."

        payload = response.json()
        candidates = payload.get("candidates", [])
        if not candidates:
            return "I could not generate an answer from the selected PDF."
        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [
            part.get("text", "")
            for part in parts
            if part.get("text") and not part.get("thought", False)
        ]
        if not text_parts:
            # Fallback if text was in single part without thought flag
            text_parts = [part.get("text", "") for part in parts if part.get("text")]
        return "\n".join(text_parts).strip() or "I could not generate an answer."

    async def stream_answer_question(
        self,
        question: str,
        context_chunks: List[Any],
        previous_messages: List[Dict[str, str]],
    ):
        """Streaming generator that guarantees identical model fallback and retry resilience."""
        answer = await self.answer_question(question, context_chunks, previous_messages)
        yield answer

