# Import required FastAPI components for building the API
import os
import shutil
import tempfile
from typing import Optional

# Import gpxpy for GPX file processing
import gpxpy
from aimakerspace.text_utils import CharacterTextSplitter, PDFLoader
from aimakerspace.vectordatabase import VectorDatabase
from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI

# Import Pydantic for data validation and settings management
from pydantic import BaseModel

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)


# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str  # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str  # OpenAI API key for authentication
    file_name: str


class SearchRequestModel(BaseModel):
    query: str
    k: int = 3


# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)

        # --- RAG: Retrieve relevant context from Qdrant ---
        vector_db = VectorDatabase()
        # Search for top 5 relevant chunks
        relevant_chunks = vector_db.search_by_text(
            request.user_message,
            k=5,
            return_as_text=True,
            file_name=request.file_name,
        )
        context = "\n".join(relevant_chunks)  # type: ignore[arg-type]
        # Compose the context-augmented system/developer message
        rag_message = (
            "You are a helpful assistant."
            " Use the following context from the user's document "
            "to answer the question.\nContext:\n" + context
        )

        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "system", "content": rag_message},
                    {"role": "user", "content": request.user_message},
                ],
                stream=True,  # Enable streaming response
            )

            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")

    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))


# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    health_status = {"api": "ok", "vector_db": "unknown", "overall": "ok"}

    # Check vector database connection
    try:
        vector_db = VectorDatabase()
        # Try a simple operation to verify connection
        vector_db.client.get_collections()
        health_status["vector_db"] = "ok"
    except Exception as e:
        health_status["vector_db"] = "error"
        health_status["vector_db_error"] = str(e)
        health_status["overall"] = "degraded"

    return health_status


@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Save uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Load and extract text from PDF
        loader = PDFLoader(tmp_path)
        documents = loader.load_documents()  # List of extracted text (usually one item)
        if not documents or not documents[0].strip():
            raise HTTPException(
                status_code=400, detail="No extractable text found in PDF."
            )

        # Chunk the text
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_texts(documents)
        if not chunks:
            raise HTTPException(status_code=400, detail="Failed to chunk PDF text.")

        # Upload chunks to vector database, include file name
        vector_db = VectorDatabase()
        await vector_db.abuild_from_list(chunks, file_name=file.filename)

        return {"status": "success", "chunks_uploaded": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.post("/api/upload_gpx")
async def upload_gpx(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="Only GPX files are supported.")

    # Save uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".gpx") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Parse GPX file
        with open(tmp_path) as gpx_file:
            gpx = gpxpy.parse(gpx_file)

        # Extract summary and details
        summary = f"GPX file: {file.filename}\n"
        if gpx.tracks:
            for i, track in enumerate(gpx.tracks):
                summary += f"Track {i+1}: {track.name or 'Unnamed'}\n"
                for j, segment in enumerate(track.segments):
                    points = segment.points
                    summary += f"  Segment {j+1}: {len(points)} points\n"
                    if points:
                        start = points[0]
                        end = points[-1]
                        summary += (
                            f"    Start: ({start.latitude}, {start.longitude})\n"
                            f"    End: ({end.latitude}, {end.longitude})\n"
                        )
                        total_distance = segment.length_3d() / 1000  # km
                        summary += f"    Distance: {total_distance:.2f} km\n"
                        elev_gain = sum(
                            max(0, b.elevation - a.elevation)
                            for a, b in zip(points, points[1:])
                            if a.elevation is not None and b.elevation is not None
                        )
                        summary += f"    Elevation gain: {elev_gain:.1f} m\n"
        else:
            summary += "No tracks found.\n"

        # Chunk the summary (could be improved for large files)
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_texts([summary])
        if not chunks:
            raise HTTPException(status_code=400, detail="Failed to chunk GPX data.")

        # Upload chunks to vector database, include file name and type
        vector_db = VectorDatabase()
        await vector_db.abuild_from_list(chunks, file_name=file.filename)
        return {"status": "success", "chunks_uploaded": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing GPX: {str(e)}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.post("/api/search")
async def search_chunks(request: SearchRequestModel = Body(...)):
    """Search for the top-k most similar chunks in the vector database using Qdrant."""
    try:
        vector_db = VectorDatabase()
        results = vector_db.search_by_text(request.query, k=request.k)
        # results: List[Tuple[str, float]]
        return {"results": [{"text": text, "score": score} for text, score in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during search: {str(e)}")


@app.get("/api/files")
async def list_files():
    """Return a list of unique file names stored in Qdrant."""
    vector_db = VectorDatabase()
    # Scroll all points and collect unique file names
    file_names = set()
    scroll = vector_db.client.scroll(
        collection_name=vector_db.collection_name, limit=1000
    )
    for batch in scroll[0]:
        payload = batch.payload or {}
        if "file_name" in payload:
            file_names.add(payload["file_name"])
    return {"files": sorted(file_names)}


# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn

    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
