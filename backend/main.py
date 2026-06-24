from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from query import query_rag

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fluffy-horse-bc36e6.netlify.app"],
    allow_origin_regex=r"https://.*--fluffy-horse-bc36e6\.netlify\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

@app.get("/")
def root():
    return {"status": "IIIT Delhi assistant is running"}

@app.post("/seed")
def seed_documents():
    import os
    from ingest import ingest_pdf
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    from config import GEMINI_API_KEY, CHROMA_DB_PATH, COLLECTION_NAME

    docs_folder = "./docs"

    # Get all PDFs in docs folder
    pdf_files = [f for f in os.listdir(docs_folder) if f.endswith(".pdf")]
    if not pdf_files:
        return {"message": "No PDFs found in docs folder", "seeded": []}

    # Get already seeded sources from ChromaDB
    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-001",
            google_api_key=GEMINI_API_KEY
        )
        db = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=CHROMA_DB_PATH
        )
        results = db._collection.get()
        already_seeded = set([m["source"] for m in results["metadatas"]])
    except Exception:
        already_seeded = set()

    # Only seed PDFs not already in ChromaDB
    to_seed = [f for f in pdf_files if f not in already_seeded]
    skipped = [f for f in pdf_files if f in already_seeded]

    if not to_seed:
        return {
            "message": "All PDFs already seeded",
            "skipped": skipped,
            "seeded": []
        }

    seeded = []
    failed = []
    for filename in to_seed:
        file_path = os.path.join(docs_folder, filename)
        try:
            count = ingest_pdf(file_path, filename)
            seeded.append({"file": filename, "chunks": count})
        except Exception as e:
            failed.append({"file": filename, "error": str(e)})

    return {
        "message": f"Seeded {len(seeded)} new PDFs, skipped {len(skipped)} already seeded",
        "seeded": seeded,
        "skipped": skipped,
        "failed": failed
    }

@app.get("/sources")
def get_sources():
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    from config import GEMINI_API_KEY, CHROMA_DB_PATH, COLLECTION_NAME
    
    embeddings = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
        google_api_key=GEMINI_API_KEY
    )
    db = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_DB_PATH
    )
    results = db._collection.get()
    sources = list(set([m["source"] for m in results["metadatas"]]))
    return {"sources": sorted(sources)}

@app.post("/query")
async def query(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    result = query_rag(request.question)
    return result