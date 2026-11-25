"""RAG knowledge base search and citation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.rag_service import rag_engine

router = APIRouter(prefix="/api/v1/rag", tags=["RAG Knowledge"])


@router.get("/search")
def search_knowledge(
    q: str = Query(..., min_length=2, max_length=400),
    top_k: int = Query(default=4, ge=1, le=10),
):
    """Retrieve grounded environmental guidelines, health advisories, and policy excerpts with citations."""
    return {"query": q, "citations": rag_engine.retrieve(query=q, top_k=top_k)}


@router.get("/documents")
def list_knowledge_documents():
    """List trusted environmental and public health documents indexed in RAG."""
    return {"documents": rag_engine.list_documents(), "chunk_count": len(rag_engine.chunks)}
