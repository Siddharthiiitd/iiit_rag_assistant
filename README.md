# IIIT Delhi RAG Assistant

A conversational AI assistant for IIIT Delhi students built with Retrieval-Augmented Generation (RAG) and Corrective RAG (CRAG). Ask natural language questions about college regulations, academic policies, and BTech requirements — get cited answers instantly.

## Live Demo URL
> https://fluffy-horse-bc36e6.netlify.app/

## What it does

Students can ask questions like:
- "What is the minimum attendance requirement?"
- "What is the grading scheme for BTech students?"
- "What are the graduation requirements?"
- "What happens if I fail a course?"

The assistant retrieves the most relevant sections from official IIIT Delhi documents and generates a grounded answer with source citations (document name + page number). If the documents don't contain the answer, it says so instead of hallucinating.

## Architecture
Ingestion (one-time):

PDF Documents → PyMuPDF → Text Chunker → Gemini Embeddings → ChromaDB
Query (every request):

User Question → Embed → ChromaDB Similarity Search → CRAG Relevance Check → Gemini 2.5 Flash → Answer + Sources

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| PDF Parsing | PyMuPDF |
| Chunking | LangChain RecursiveCharacterTextSplitter |
| Embeddings | Gemini Embedding 001 |
| Vector Store | ChromaDB |
| LLM | Gemini 2.5 Flash |
| Frontend | Next.js + Tailwind CSS |
| Deployment | Railway + Vercel |

## Key Technical Decisions

**Why RAG over fine-tuning?** College regulations change every year. RAG lets us update the knowledge base by simply re-running the seed script — no retraining needed.

**Why vector search over keyword search?** Semantic search finds meaning-matches, not just word-matches. "Attendance rule" and "minimum attendance threshold" return the same results even though they share no keywords.

**Why Corrective RAG?** Basic RAG always retrieves something even if it's irrelevant. CRAG adds a relevance scoring step — if retrieved chunks don't actually answer the question, the system falls back gracefully instead of generating a hallucinated answer.

**Why 500-token chunks with 50-token overlap?** Small enough for precise retrieval, large enough to preserve sentence context. Overlap ensures sentences at chunk boundaries aren't lost.

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Gemini API key (free tier at aistudio.google.com)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
GEMINI_API_KEY=your_key_here

Add PDFs to `backend/docs/` then:
```bash
python seed.py
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

## Project Structure
iiitd-rag-assistant/

├── backend/

│   ├── main.py        # FastAPI server — exposes /query endpoint

│   ├── ingest.py      # PDF parsing, chunking, embedding pipeline

│   ├── query.py       # Retrieval, CRAG scoring, answer generation

│   ├── seed.py        # One-time script to ingest docs into ChromaDB

│   └── config.py      # API keys and configuration constants

└── frontend/

└── app/

└── page.tsx   # Chat UI with message bubbles and source citations
