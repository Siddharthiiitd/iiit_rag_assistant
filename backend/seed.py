import os
from ingest import ingest_pdf

# Put your college PDFs in a folder called /docs
DOCS_FOLDER = "./docs"

def seed():
    pdf_files = [f for f in os.listdir(DOCS_FOLDER) if f.endswith(".pdf")]
    
    if not pdf_files:
        print("No PDFs found in /docs folder")
        return
    
    for filename in pdf_files:
        file_path = os.path.join(DOCS_FOLDER, filename)
        print(f"Ingesting: {filename}...")
        count = ingest_pdf(file_path, filename)
        print(f"Done — {count} chunks stored from {filename}")
    
    print("\nAll documents seeded successfully.")

if __name__ == "__main__":
    seed()