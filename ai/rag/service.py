"""RAG simple : découpage → embeddings → VectorStore. Le store (pgvector) est injecté par l'application."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ai.providers.base import AIProvider, CallContext


@dataclass(frozen=True)
class Passage:
    document_id: str
    title: str
    version: int
    content: str
    score: float


class VectorStore(Protocol):
    def add_chunks(self, establishment_id: str, document_id: str, texts: list[str], vectors: list[list[float]]) -> None: ...

    def search(self, establishment_id: str, vector: list[float], k: int) -> list[Passage]:
        """Doit ne retourner que des documents approuvés de CET établissement."""
        ...


def chunk_text(text: str, max_chars: int = 800, overlap: int = 100) -> list[str]:
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    cur = ""
    for p in paras:
        if cur and len(cur) + len(p) + 2 > max_chars:
            chunks.append(cur)
            cur = cur[-overlap:] + "\n\n" + p if overlap else p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
        while len(cur) > max_chars * 2:  # paragraphe géant
            chunks.append(cur[:max_chars])
            cur = cur[max_chars - overlap:]
    if cur:
        chunks.append(cur)
    return chunks


class RagService:
    def __init__(self, provider: AIProvider, store: VectorStore):
        self.provider, self.store = provider, store

    def ingest(self, ctx: CallContext, document_id: str, text: str) -> int:
        chunks = chunk_text(text)
        if not chunks:
            return 0
        vectors = self.provider.embed(ctx, chunks)
        self.store.add_chunks(ctx.establishment_id, document_id, chunks, vectors)
        return len(chunks)

    def retrieve(self, ctx: CallContext, query: str, k: int = 4) -> list[Passage]:
        vec = self.provider.embed(ctx, [query])[0]
        return self.store.search(ctx.establishment_id, vec, k)


def format_context(passages: list[Passage]) -> str:
    if not passages:
        return "(aucune procédure approuvée trouvée)"
    return "\n\n".join(f"[{p.title} v{p.version}]\n{p.content}" for p in passages)
