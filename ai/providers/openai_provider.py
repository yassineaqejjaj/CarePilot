"""Unique point d'appel à l'API OpenAI (Responses + Embeddings)."""
from __future__ import annotations

import logging
import os

from ai.guardrails import contains_direct_identifier
from ai.providers.base import (
    AIDisabledError,
    AIError,
    BudgetExceededError,
    CallContext,
    GuardrailError,
    T,
    UsageRecord,
    UsageSink,
)

log = logging.getLogger("carepilot.ai")


class OpenAIProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        llm_model: str | None = None,
        embedding_model: str | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        price_in_per_1m_eur: float | None = None,
        price_out_per_1m_eur: float | None = None,
        usage_sink: UsageSink | None = None,
        client=None,
    ):
        env = os.environ.get
        self.llm_model = llm_model or env("OPENAI_LLM_MODEL", "")
        self.embedding_model = embedding_model or env("OPENAI_EMBEDDING_MODEL", "")
        self.price_in = price_in_per_1m_eur if price_in_per_1m_eur is not None else float(env("OPENAI_PRICE_IN_PER_1M_EUR", "0"))
        self.price_out = price_out_per_1m_eur if price_out_per_1m_eur is not None else float(env("OPENAI_PRICE_OUT_PER_1M_EUR", "0"))
        self.usage_sink = usage_sink
        if client is None:
            from openai import OpenAI

            client = OpenAI(
                api_key=api_key or env("OPENAI_API_KEY"),
                timeout=timeout if timeout is not None else float(env("OPENAI_TIMEOUT_SECONDS", "30")),
                max_retries=max_retries if max_retries is not None else int(env("OPENAI_MAX_RETRIES", "3")),
            )
        self._client = client

    # -- garde-fous communs -------------------------------------------------
    def _check(self, ctx: CallContext, texts: list[str], model: str) -> None:
        if not ctx.ai_enabled:
            raise AIDisabledError("Fonctions IA désactivées pour cet établissement")
        if not model:
            raise AIError("Nom de modèle OpenAI non configuré (variables d'environnement)")
        if ctx.monthly_token_budget is not None and ctx.tokens_used_this_month >= ctx.monthly_token_budget:
            raise BudgetExceededError("Budget mensuel de tokens atteint")
        if any(contains_direct_identifier(t) for t in texts):
            raise GuardrailError("Identifiant direct détecté : envoi à OpenAI refusé")

    def _record(self, ctx: CallContext, model: str, kind: str, tin: int, tout: int) -> None:
        cost = (tin * self.price_in + tout * self.price_out) / 1_000_000
        # Métadonnées uniquement : jamais de prompt ni de réponse dans les logs.
        log.info("openai_call est=%s agent=%s kind=%s model=%s in=%d out=%d cost_eur=%.6f",
                 ctx.establishment_id, ctx.agent, kind, model, tin, tout, cost)
        if self.usage_sink:
            self.usage_sink(UsageRecord(ctx.establishment_id, ctx.agent, model, kind, tin, tout, cost))

    # -- API ---------------------------------------------------------------
    def generate_structured(self, ctx: CallContext, *, instructions: str, user_input: str, schema: type[T]) -> T:
        self._check(ctx, [instructions, user_input], self.llm_model)
        try:
            resp = self._client.responses.parse(
                model=self.llm_model,
                instructions=instructions,
                input=user_input,
                text_format=schema,
                store=False,  # pas de rétention côté OpenAI au-delà du minimum contractuel
            )
        except Exception as exc:  # erreurs réseau/API déjà retentées par le SDK
            raise AIError(f"Appel OpenAI échoué : {type(exc).__name__}") from exc
        parsed = resp.output_parsed
        if parsed is None:
            raise AIError("Réponse OpenAI non conforme au schéma attendu")
        usage = getattr(resp, "usage", None)
        self._record(ctx, self.llm_model, "llm", getattr(usage, "input_tokens", 0), getattr(usage, "output_tokens", 0))
        return schema.model_validate(parsed.model_dump())

    def embed(self, ctx: CallContext, texts: list[str]) -> list[list[float]]:
        self._check(ctx, texts, self.embedding_model)
        try:
            resp = self._client.embeddings.create(model=self.embedding_model, input=texts)
        except Exception as exc:
            raise AIError(f"Appel embeddings échoué : {type(exc).__name__}") from exc
        tokens = getattr(getattr(resp, "usage", None), "total_tokens", 0)
        self._record(ctx, self.embedding_model, "embedding", tokens, 0)
        return [d.embedding for d in resp.data]
