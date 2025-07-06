import asyncio
import os
import uuid
from typing import List, Optional, Tuple

import numpy as np
from aimakerspace.openai_utils.embedding import EmbeddingModel
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams


def cosine_similarity(vector_a: np.array, vector_b: np.array) -> float:
    """Computes the cosine similarity between two vectors."""
    dot_product = np.dot(vector_a, vector_b)
    norm_a = np.linalg.norm(vector_a)
    norm_b = np.linalg.norm(vector_b)
    return dot_product / (norm_a * norm_b)


class VectorDatabase:
    def __init__(
        self,
        embedding_model: Optional[EmbeddingModel] = None,
        collection_name: str = "default",
    ):
        self.embedding_model = embedding_model or EmbeddingModel()
        self.collection_name = collection_name
        # Qdrant connection
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        api_key = os.getenv("QDRANT_API_KEY", None)
        self.client = QdrantClient(url=qdrant_url, api_key=api_key)
        self._ensure_collection()

    def _ensure_collection(self):
        # Create collection if it doesn't exist
        if self.collection_name not in [
            c.name for c in self.client.get_collections().collections
        ]:
            self.client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=1536, distance=Distance.COSINE
                ),  # 1536 for OpenAI embeddings
            )

    def insert(
        self, text: str, vector: np.array, file_name: Optional[str] = None
    ) -> None:
        # Use a UUID for each point
        point_id = str(uuid.uuid4())
        payload = {"text": text}
        if file_name:
            payload["file_name"] = file_name
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector.tolist(),
                    payload=payload,
                )
            ],
        )

    def search(
        self, query_vector: List[float], k: int, file_name: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        # Filter by file_name if provided
        search_filter = None
        if file_name:
            search_filter = {
                "must": [{"key": "file_name", "match": {"value": file_name}}]
            }
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=k,
            query_filter=search_filter,
        )
        return [(hit.payload.get("text", ""), hit.score) for hit in results]

    def search_by_text(
        self,
        query_text: str,
        k: int,
        return_as_text: bool = False,
        file_name: Optional[str] = None,
    ) -> List[Tuple[str, float]]:
        query_vector = self.embedding_model.get_embedding(query_text)
        results = self.search(query_vector, k, file_name=file_name)
        return (
            [r[0] for r in results] if return_as_text else results  # type: ignore[misc]
        )

    def retrieve_from_key(self, key: str) -> Optional[str]:
        # Not directly supported; would need to search by payload
        hits = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter={"must": [{"key": "text", "match": {"value": key}}]},
            limit=1,
        )
        if hits[0]:
            return hits[0][0].payload.get("text", None)
        return None

    async def abuild_from_list(
        self, list_of_text: List[str], file_name: Optional[str] = None
    ) -> "VectorDatabase":
        embeddings = await self.embedding_model.async_get_embeddings(list_of_text)
        for text, embedding in zip(list_of_text, embeddings):
            self.insert(text, np.array(embedding), file_name=file_name)
        return self


if __name__ == "__main__":
    list_of_text = [
        "I like to eat broccoli and bananas.",
        "I ate a banana and spinach smoothie for breakfast.",
        "Chinchillas and kittens are cute.",
        "My sister adopted a kitten yesterday.",
        "Look at this cute hamster munching on a piece of broccoli.",
    ]

    vector_db = VectorDatabase()
    vector_db = asyncio.run(vector_db.abuild_from_list(list_of_text))
    k = 2

    searched_vector = vector_db.search_by_text("I think fruit is awesome!", k=k)
    print(f"Closest {k} vector(s):", searched_vector)

    retrieved_vector = vector_db.retrieve_from_key(
        "I like to eat broccoli and bananas."
    )
    print("Retrieved vector:", retrieved_vector)

    relevant_texts = vector_db.search_by_text(
        "I think fruit is awesome!", k=k, return_as_text=True
    )
    print(f"Closest {k} text(s):", relevant_texts)
