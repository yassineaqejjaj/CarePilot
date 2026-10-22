"""Contrat commun des providers IA. Aucun import de `app.*` : la couche IA est indépendante."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class AIError(Exception):
    pass


class AIDisabledError(AIError):
    """Fonctions IA désactivées (globalement ou pour l'établissement)."""


class BudgetExceededError(AIError):
    """Budget mensuel de tokens de l'établissement épuisé."""


class GuardrailError(AIError):
    """Entrée ou sortie refusée par les garde-fous."""


@dataclass(frozen=True)
class UsageRecord:
    establishment_id: str
    agent: str
    model: str
    kind: str  # "llm" | "embedding"
    input_tokens: int
    output_tokens: int
    cost_eur: float


@dataclass(frozen=True)
class CallContext:
    """Contexte d'un appel : qui paie, quel agent, l'IA est-elle autorisée."""
    establishment_id: str
    agent: str
    ai_enabled: bool = True
    monthly_token_budget: int | None = None
    tokens_used_this_month: int = 0


UsageSink = Callable[[UsageRecord], None]


class AIProvider(Protocol):
    def generate_structured(
        self, ctx: CallContext, *, instructions: str, user_input: str, schema: type[T]
    ) -> T: ...

    def embed(self, ctx: CallContext, texts: list[str]) -> list[list[float]]: ...
