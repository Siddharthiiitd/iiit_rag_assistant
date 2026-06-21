import os
import sys
from ingest import ingest_pdf

DOCS_FOLDER = "./docs"

def seed(filename=None):
    if filename:
        # seed single file
        pdf_files = [filename]
    else:
        # seed all files
        pdf_files = [f for f in os.listdir(DOCS_FOLDER) if f.endswith(".pdf")]

    if not pdf_files:
        print("No PDFs found")
        return

    for filename in pdf_files:
        file_path = os.path.join(DOCS_FOLDER, filename)
        if not os.path.exists(file_path):
            print(f"File not found: {filename}")
            return
        print(f"Ingesting: {filename}...")
        count = ingest_pdf(file_path, filename)
        print(f"Done — {count} chunks stored from {filename}")

    print("\nAll done.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        seed(sys.argv[1])
    else:
        seed()