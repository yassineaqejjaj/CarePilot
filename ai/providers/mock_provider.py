"""Provider factice pour les tests et le développement hors ligne : aucun appel réseau."""
from __future__ import annotations

import hashlib
import math

from ai.guardrails import contains_direct_identifier
from ai.providers.base import AIDisabledError, AIError, CallContext, GuardrailError, T, UsageRecord, UsageSink


class MockProvider:
    def __init__(self, dim: int = 64, usage_sink: UsageSink | None = None):
        self.dim = dim
        self.usage_sink = usage_sink
        self.responses: dict[type, object] = {}
        self.calls: list[dict] = []  # permet de vérifier ce qui "partirait" chez OpenAI

    def set_response(self, schema: type[T], value: T) -> None:
        self.responses[schema] = value

    def _guard(self, ctx: CallContext, texts: list[str]) -> None:
        if not ctx.ai_enabled:
            raise AIDisabledError("Fonctions IA désactivées pour cet établissement")
        if any(contains_direct_identifier(t) for t in texts):
            raise GuardrailError("Identifiant direct détecté : envoi refusé")

    def generate_structured(self, ctx: CallContext, *, instructions: str, user_input: str, schema: type[T]) -> T:
        self._guard(ctx, [instructions, user_input])
        self.calls.append({"agent": ctx.agent, "instructions": instructions, "input": user_input})
        if schema not in self.responses:
            raise AIError(f"MockProvider: aucune réponse configurée pour {schema.__name__}")
        if self.usage_sink:
            self.usage_sink(UsageRecord(ctx.establishment_id, ctx.agent, "mock", "llm", 100, 50, 0.0))
        return self.responses[schema]  # type: ignore[return-value]

    def embed(self, ctx: CallContext, texts: list[str]) -> list[list[float]]:
        self._guard(ctx, texts)
        return [self._vec(t) for t in texts]

    def _vec(self, text: str) -> list[float]:
        """Sac de mots haché, normalisé : la similarité cosinus reflète le recouvrement lexical."""
        v = [0.0] * self.dim
        for w in text.lower().split():
            h = int(hashlib.sha256(w.encode()).hexdigest(), 16)
            v[h % self.dim] += 1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]
