from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from typing import List, Optional

from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from ai_service import (
    process_pdf_and_embed,
    answer_study_query,
    generate_pdf_summary,
    generate_flashcards
)

# SQLite Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./study_ai.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBNote(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Study.ai Backend Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "./uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class QueryRequest(BaseModel):
    query: str

class NoteSchema(BaseModel):
    id: str
    title: str
    content: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "online", "message": "Study.ai Backend is running."}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        # Process and embed chunks
        chunks_count = await process_pdf_and_embed(contents, file.filename)
        
        # Returned filename so frontend displays "Indexed: filename.pdf" instead of undefined
        return {
            "status": "success", 
            "chunks": chunks_count,
            "filename": file.filename
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/query")
async def query_ai(req: QueryRequest):
    try:
        res = await answer_study_query(req.query)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_document():
    try:
        summary = await generate_pdf_summary()
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/flashcards")
async def get_flashcards():
    try:
        cards = await generate_flashcards()
        return {"flashcards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Database Notes Endpoints
@app.get("/db/notes")
def get_saved_notes():
    db = SessionLocal()
    notes = db.query(DBNote).all()
    db.close()
    return [{"id": n.id, "title": n.title, "content": n.content} for n in notes]

@app.post("/db/notes")
def save_or_update_note(note: NoteSchema):
    db = SessionLocal()
    existing = db.query(DBNote).filter(DBNote.id == note.id).first()
    if existing:
        existing.title = note.title
        existing.content = note.content
    else:
        new_note = DBNote(id=note.id, title=note.title, content=note.content)
        db.add(new_note)
    db.commit()
    db.close()
    return {"status": "saved"}

@app.delete("/db/notes/{note_id}")
def delete_note(note_id: str):
    db = SessionLocal()
    db.query(DBNote).filter(DBNote.id == note_id).delete()
    db.commit()
    db.close()
    return {"status": "deleted"}