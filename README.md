# 📚 Study.ai — AI-Powered Learning Workspace

**Study.ai** is an intelligent study assistant that transforms lecture notes, textbooks, and PDF documents into interactive study materials. Upload your documents to summarize content, generate flashcards, and ask questions using Retrieval-Augmented Generation (RAG).

---

## ✨ Features

- 📑 **PDF Ingestion & Vector Search:** Fast vector indexing powered by Pinecone.
- ⚡ **Document Summaries:** Generates structured executive summaries and key exam takeaways.
- 🎴 **Interactive Flashcards:** Auto-extracts key concepts and terms into study cards.
- 🤖 **Flexible AI Provider:** Supports both local LLMs (via Ollama) and cloud models (via Google Gemini API).

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (TypeScript, Tailwind CSS)
- **Backend:** FastAPI (Python, LangChain)
- **Vector Database:** Pinecone
- **AI Models:** Ollama / Google Gemini API

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js (v18+)
- Python (3.10+)
- Pinecone API Key
- Google Gemini API Key (or local Ollama setup)

### 2. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
