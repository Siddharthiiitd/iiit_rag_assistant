from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from query import query_rag

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fluffy-horse-bc36e6.netlify.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

@app.get("/")
def root():
    return {"status": "IIIT Delhi assistant is running"}

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