import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from config import GEMINI_API_KEY, CHROMA_DB_PATH, COLLECTION_NAME
import time

def load_and_chunk_pdf(file_path: str, filename: str):
    # Step 1: Extract text from PDF
    doc = fitz.open(file_path)
    pages = []
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if text.strip():  # skip blank pages
            pages.append({
                "text": text,
                "page": page_num + 1,
                "source": filename
            })
    doc.close()
    return pages

def chunk_pages(pages: list):
    # Step 2: Split into smaller chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ".", " "]
    )
    chunks = []
    for page in pages:
        splits = splitter.split_text(page["text"])
        for split in splits:
            chunks.append({
                "text": split,
                "metadata": {
                    "source": page["source"],
                    "page": page["page"]
                }
            })
    return chunks

def store_chunks(chunks: list):
    embeddings = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
        google_api_key=GEMINI_API_KEY,
        client_options={"api_endpoint": "generativelanguage.googleapis.com"},
        transport="rest"
    )
    
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_DB_PATH
    )

    # Process in small batches to avoid quota limits
    batch_size = 10
    total = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [c["text"] for c in batch]
        metadatas = [c["metadata"] for c in batch]
        
        retries = 3
        for attempt in range(retries):
            try:
                vectorstore.add_texts(texts=texts, metadatas=metadatas)
                total += len(texts)
                print(f"  Stored batch {i//batch_size + 1} ({total} chunks so far)")
                time.sleep(2)  # pause between batches to respect rate limit
                break
            except Exception as e:
                if attempt < retries - 1:
                    wait = 30 * (attempt + 1)
                    print(f"  Rate limited, waiting {wait}s before retry...")
                    time.sleep(wait)
                else:
                    raise e
    
    return total

def ingest_pdf(file_path: str, filename: str):
    pages = load_and_chunk_pdf(file_path, filename)
    chunks = chunk_pages(pages)
    count = store_chunks(chunks)
    return count