"""RAG Knowledge System over trusted environmental, health, and policy documents."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from ..core.config import KNOWLEDGE_DIR, get_settings
from ..schemas.airguard import RAGCitation

TOKEN_RE = re.compile(r"[a-z0-9_.-]+")


@dataclass
class KnowledgeChunk:
    doc_id: str
    title: str
    section: str
    source_org: str
    source_url: str
    published_year: str
    text: str
    tokens: List[str]
    tf: Counter


class RAGKnowledgeEngine:
    """Hybrid BM25-style lexical retriever with optional IBM Granite/Watsonx embedding boost."""

    def __init__(self, knowledge_dir: Path = KNOWLEDGE_DIR) -> None:
        self.knowledge_dir = knowledge_dir
        self.chunks: List[KnowledgeChunk] = []
        self.doc_freq: Counter = Counter()
        self.avg_len: float = 1.0
        self._chunk_embeddings: Optional[List[List[float]]] = None
        self._load_documents()

    def _tokenize(self, text: str) -> List[str]:
        return [t for t in TOKEN_RE.findall(text.lower()) if len(t) > 1]

    def _load_documents(self) -> None:
        if not self.knowledge_dir.exists():
            return
        all_chunks: List[KnowledgeChunk] = []
        for path in sorted(self.knowledge_dir.glob("*.md")):
            raw = path.read_text(encoding="utf-8")
            lines = raw.splitlines()
            title = path.stem.replace("_", " ").title()
            source_org = "Environmental Health Authority"
            source_url = "https://www.who.int/"
            published_year = "2024"

            body_lines: List[str] = []
            for line in lines:
                if line.startswith("# "):
                    title = line[2:].strip()
                elif line.startswith("Source:"):
                    source_org = line.split(":", 1)[1].strip()
                elif line.startswith("URL:"):
                    source_url = line.split(":", 1)[1].strip()
                elif line.startswith("Published:"):
                    published_year = line.split(":", 1)[1].strip()
                else:
                    body_lines.append(line)

            # Split by ## headings into grounded knowledge chunks
            current_section = "Overview"
            buffer: List[str] = []
            for line in body_lines:
                if line.startswith("## "):
                    if buffer and "\n".join(buffer).strip():
                        text = "\n".join(buffer).strip()
                        tokens = self._tokenize(f"{title} {current_section} {text}")
                        all_chunks.append(
                            KnowledgeChunk(
                                doc_id=path.stem,
                                title=title,
                                section=current_section,
                                source_org=source_org,
                                source_url=source_url,
                                published_year=published_year,
                                text=text,
                                tokens=tokens,
                                tf=Counter(tokens),
                            )
                        )
                    current_section = line[3:].strip()
                    buffer = []
                else:
                    buffer.append(line)

            if buffer and "\n".join(buffer).strip():
                text = "\n".join(buffer).strip()
                tokens = self._tokenize(f"{title} {current_section} {text}")
                all_chunks.append(
                    KnowledgeChunk(
                        doc_id=path.stem,
                        title=title,
                        section=current_section,
                        source_org=source_org,
                        source_url=source_url,
                        published_year=published_year,
                        text=text,
                        tokens=tokens,
                        tf=Counter(tokens),
                    )
                )

        self.chunks = all_chunks
        if not self.chunks:
            return
        df: Counter = Counter()
        for c in self.chunks:
            for tok in set(c.tokens):
                df[tok] += 1
        self.doc_freq = df
        self.avg_len = sum(len(c.tokens) for c in self.chunks) / max(1, len(self.chunks))

    def _bm25_score(self, query_tokens: List[str], chunk: KnowledgeChunk) -> float:
        k1 = 1.4
        b = 0.75
        n_docs = len(self.chunks)
        doc_len = max(1, len(chunk.tokens))
        score = 0.0
        for tok in query_tokens:
            if tok not in chunk.tf:
                continue
            df = self.doc_freq.get(tok, 0)
            idf = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))
            tf = chunk.tf[tok]
            denom = tf + k1 * (1 - b + b * (doc_len / self.avg_len))
            score += idf * ((tf * (k1 + 1)) / max(1e-6, denom))
        return score

    def _try_watsonx_embeddings(self, texts: List[str]) -> Optional[List[List[float]]]:
        settings = get_settings()
        if not settings.is_granite_configured:
            return None
        try:
            from ibm_watsonx_ai import APIClient, Credentials
            from ibm_watsonx_ai.foundation_models import Embeddings

            creds = Credentials(url=settings.watsonx_ai_url, api_key=settings.effective_watsonx_ai_key)
            client = APIClient(credentials=creds, project_id=settings.watsonx_project_id)
            emb = Embeddings(
                model_id=settings.watsonx_embedding_model_id,
                api_client=client,
                project_id=settings.watsonx_project_id,
            )
            vectors = emb.embed_documents(texts=texts)
            if isinstance(vectors, list) and len(vectors) == len(texts):
                return vectors
        except Exception:
            return None
        return None

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

    def retrieve(self, query: str, top_k: int = 4) -> List[RAGCitation]:
        """Retrieve top-k authoritative knowledge chunks with normalized relevance scores."""
        if not self.chunks:
            return []
        q_tokens = self._tokenize(query)
        if not q_tokens:
            q_tokens = ["aqi", "health"]

        lexical_scores = [self._bm25_score(q_tokens, c) for c in self.chunks]

        # Optional semantic boost via IBM watsonx.ai embeddings
        semantic_scores = [0.0] * len(self.chunks)
        settings = get_settings()
        if settings.is_granite_configured:
            if self._chunk_embeddings is None:
                self._chunk_embeddings = self._try_watsonx_embeddings([c.text for c in self.chunks])
            if self._chunk_embeddings is not None:
                q_vecs = self._try_watsonx_embeddings([query])
                if q_vecs and len(q_vecs) == 1:
                    semantic_scores = [max(0.0, self._cosine(q_vecs[0], v)) for v in self._chunk_embeddings]

        max_lex = max(lexical_scores) or 1.0
        combined = []
        for idx, chunk in enumerate(self.chunks):
            lex_norm = lexical_scores[idx] / max_lex
            sem_norm = semantic_scores[idx]
            total = (0.65 * lex_norm + 0.35 * sem_norm) if max(semantic_scores) > 0 else lex_norm
            combined.append((total, chunk))

        combined.sort(key=lambda item: item[0], reverse=True)
        results: List[RAGCitation] = []
        for score, chunk in combined[:top_k]:
            excerpt = chunk.text.replace("\n", " ").strip()
            if len(excerpt) > 320:
                excerpt = excerpt[:317].rsplit(" ", 1)[0] + "..."
            results.append(
                RAGCitation(
                    doc_id=chunk.doc_id,
                    title=chunk.title,
                    section=chunk.section,
                    source_org=chunk.source_org,
                    source_url=chunk.source_url,
                    published_year=chunk.published_year,
                    relevance_score=round(float(score), 3),
                    excerpt=excerpt,
                )
            )
        return results

    def list_documents(self) -> List[Dict[str, str]]:
        """List unique indexed knowledge sources."""
        seen: Dict[str, Dict[str, str]] = {}
        for chunk in self.chunks:
            if chunk.doc_id not in seen:
                seen[chunk.doc_id] = {
                    "doc_id": chunk.doc_id,
                    "title": chunk.title,
                    "source_org": chunk.source_org,
                    "source_url": chunk.source_url,
                    "published_year": chunk.published_year,
                }
        return list(seen.values())


rag_engine = RAGKnowledgeEngine()
