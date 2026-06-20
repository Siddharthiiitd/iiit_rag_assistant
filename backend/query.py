from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from config import GEMINI_API_KEY, CHROMA_DB_PATH, COLLECTION_NAME
import time


def get_vectorstore():
    embeddings = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
        google_api_key=GEMINI_API_KEY
    )
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_DB_PATH
    )

PROMPT_TEMPLATE = """
You are a helpful assistant for IIIT Delhi students.
Answer the question using ONLY the context provided below.
If the answer is not in the context, say "I don't have enough information in the documents to answer this.

Context:
{context}

Question:
{question}

Answer:
"""

def check_relevance(question: str, chunks: list) -> bool:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0
    )
    
    context = "\n\n".join([c.page_content for c in chunks])
    
    prompt = f"""You are a relevance grader. 
Given the following retrieved document chunks and a question, determine if the chunks contain enough information to answer the question.

Chunks:
{context}

Question: {question}

Reply with only one word: RELEVANT or IRRELEVANT"""

    response = llm.invoke(prompt)
    result = response.content.strip().upper()
    print(f"Relevance check: {result}")
    return result == "RELEVANT"

def query_rag(question: str):
    # Step 1: retrieve relevant chunks
    vectorstore = get_vectorstore()
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    chunks = retriever.invoke(question)

    if not chunks:
       return {
        "answer": "No relevant information found in the documents.",
        "sources": [],
        "source_type": "irrelevant"
        }

    # Step 2.5: CRAG relevance check
    is_relevant = check_relevance(question, chunks)

    if not is_relevant:
        return {
        "answer": "The uploaded documents don't contain enough information to answer this question. Please consult the relevant department or official IIIT Delhi portal.",
        "sources": [],
        "source_type": "irrelevant"
    }

    # Step 2: build context from chunks
    context = "\n\n".join([c.page_content for c in chunks])
    sources = [
        {"source": c.metadata.get("source"), "page": c.metadata.get("page")}
        for c in chunks
    ]

    # Step 3: send to Gemini
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0.2
    )
    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )
    chain = prompt | llm

    response = None
    for attempt in range(3):
        try:
            response = chain.invoke({"context": context, "question": question})
            break
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                print(f"Rate limited, waiting 30s...")
                time.sleep(30)
            else:
                raise e

    if response is None:
        return {
            "answer": "Service is temporarily rate limited. Please try again in a minute.",
            "sources": []
        }

    return {
    "answer": response.content,
    "sources": sources,
    "source_type": "documents"
    }