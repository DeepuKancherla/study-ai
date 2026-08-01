import os
import re
import json
import tempfile
from dotenv import load_dotenv

from pydantic import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_pinecone import PineconeVectorStore

load_dotenv()

PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "study-ai")


# --- Pydantic Schema for Flashcard Output ---
class Flashcard(BaseModel):
    question: str = Field(description="The study question or key term")
    answer: str = Field(description="The concise answer or definition")

class FlashcardList(BaseModel):
    cards: list[Flashcard]


# 1. Helper to get Chat Model (Gemini or Ollama)
def get_llm():
    if PROVIDER == "ollama":
        return ChatOllama(
            model="gemma",
            base_url="http://localhost:11434"
        )
    else:
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.getenv("GEMINI_API_KEY")
        )

# 2. Helper to get Embeddings (Gemini or Ollama)
# 2. Helper to get Embeddings (Gemini or Ollama)
def get_embeddings():
    if PROVIDER == "ollama":
        return OllamaEmbeddings(
            model="nomic-embed-text",
            base_url="http://localhost:11434"
        )
    else:
        return GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-2-preview",  # Updated to current active model
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
# 3. Process uploaded PDF and store vectors in Pinecone
async def process_pdf_and_embed(file_bytes: bytes, filename: str):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name

    try:
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        chunks = text_splitter.split_documents(docs)

        embeddings = get_embeddings()
        vector_store = PineconeVectorStore.from_documents(
            documents=chunks,
            embedding=embeddings,
            index_name=INDEX_NAME
        )
        return len(chunks)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# 4. Search context and query LLM
async def answer_study_query(query: str):
    embeddings = get_embeddings()
    vector_store = PineconeVectorStore.from_existing_index(
        index_name=INDEX_NAME,
        embedding=embeddings
    )

    sources = []
    context = ""
    try:
        relevant_docs = vector_store.similarity_search(query, k=3)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
        sources = [doc.page_content for doc in relevant_docs]
    except Exception as e:
        print(f"Vector search note: {e}")

    prompt = f"""
    Context from study materials:
    {context if context else 'No context retrieved.'}

    Question:
    {query}

    Instructions:
    - Provide a direct, clear, and comprehensive answer immediately.
    - DO NOT include intros, greetings, or self-introductions.
    - Answer directly using clear Markdown formatting, section headers, bold terms, and bullet points.
    """

    llm = get_llm()
    response = llm.invoke(prompt)
    return {
        "answer": response.content,
        "sources": sources
    }

# 5. Generate document summary
# 5. Generate document summary
async def generate_pdf_summary():
    try:
        embeddings = get_embeddings()
        vector_store = PineconeVectorStore.from_existing_index(
            index_name=INDEX_NAME,
            embedding=embeddings
        )

        relevant_docs = vector_store.similarity_search("main topics summary overview key points concepts", k=5)
        context = "\n\n".join([doc.page_content for doc in relevant_docs if hasattr(doc, 'page_content')])

        if not context.strip():
            return "No document content retrieved. Please try re-uploading your PDF file."

        prompt = f"""
        Analyze the following document text and provide a comprehensive study summary.

        Document Text:
        {context}

        Format output cleanly in Markdown:
        - **Executive Summary** (2-3 sentences)
        - **Key Concepts & Topics Covered** (Bullet points)
        - **Essential Exam/Study Takeaways**
        """

        llm = get_llm()
        response = llm.invoke(prompt)
        return response.content if hasattr(response, 'content') else str(response)

    except Exception as e:
        print(f"Summary Generation Error: {e}")
        return f"Unable to generate summary right now: {str(e)}"
# 6. Generate interactive flashcards
# 6. Generate interactive flashcards
async def generate_flashcards():
    try:
        embeddings = get_embeddings()
        vector_store = PineconeVectorStore.from_existing_index(
            index_name=INDEX_NAME,
            embedding=embeddings
        )

        relevant_docs = vector_store.similarity_search("key terms definitions important concepts formulas", k=5)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])

        if not context.strip():
            return []

        prompt = f"""
        Extract 5 key concepts from the following text and convert them into study flashcards.

        Context:
        {context}

        Return a JSON object with a single key "cards" containing a list of objects with "question" and "answer".
        Example:
        {{
            "cards": [
                {{"question": "What is Machine Learning?", "answer": "A subset of AI that learns from data."}}
            ]
        }}
        """

        # Enforce JSON mode on ChatOllama if running locally
        if PROVIDER == "ollama":
            llm = ChatOllama(model="gemma", base_url="http://localhost:11434", format="json")
        else:
            llm = get_llm()

        response = llm.invoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)

        # Parse JSON
        parsed_data = json.loads(content)

        # Extract list from dictionary format
        if isinstance(parsed_data, dict):
            if "cards" in parsed_data:
                return parsed_data["cards"]
            elif "flashcards" in parsed_data:
                return parsed_data["flashcards"]
            else:
                return list(parsed_data.values())[0]
        elif isinstance(parsed_data, list):
            return parsed_data

        return []

    except Exception as e:
        print(f"Flashcard Generation Error: {e}")
        # Secondary fallback regex attempt for extra safety
        try:
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            pass

        return [
            {
                "question": "Generation Notice",
                "answer": "Ollama took too long or returned invalid syntax. Click 'Generate Flashcards' again!"
            }
        ]