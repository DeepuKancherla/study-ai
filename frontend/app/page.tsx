"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { 
  PanelLeftClose, 
  PanelLeft, 
  Upload, 
  Send, 
  BookOpen, 
  MessageSquare, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  PlusCircle, 
  Save,
  Copy,
  Check,
  Search,
  Trash2,
  BookmarkPlus,
  Layers,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileSearch
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Note {
  id: string;
  title: string;
  content: string;
}

interface Message {
  role: "user" | "ai";
  text: string;
  sources?: string[];
}

interface Flashcard {
  question: string;
  answer: string;
}

export default function StudyDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "notes" | "flashcards">("chat");

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [openSourceIndex, setOpenSourceIndex] = useState<number | null>(null);

  // Copy & Export State
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [exportedIndex, setExportedIndex] = useState<number | null>(null);

  // Notes State
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [currentNoteContent, setCurrentNoteContent] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Search & Highlight State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHighlightTerm, setActiveHighlightTerm] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  // Fetch persisted notes from SQLite DB on initial load
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(`${API_URL}/db/notes`);
        setNotes(res.data || []);
      } catch (err) {
        console.error("Failed to load notes from SQLite DB", err);
      }
    };
    fetchNotes();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("Indexing...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedFile(res.data.filename);
      setUploadStatus(`Indexed: ${res.data.filename}`);
    } catch (err: any) {
      setUploadStatus(`Failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSendQuery = async () => {
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery;
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInputQuery("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/query`, { query: userText });
      setMessages((prev) => [
        ...prev, 
        { role: "ai", text: res.data.answer, sources: res.data.sources || [] }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Error connecting to server. Please check your backend." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: "Generates document summary..." }]);

    try {
      const res = await axios.post(`${API_URL}/summarize`);
      setMessages((prev) => [...prev, { role: "ai", text: res.data.summary }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Failed to generate summary. Ensure a PDF is uploaded." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    setLoading(true);
    setActiveTab("flashcards");
    setSidebarOpen(false);

    try {
      const res = await axios.post(`${API_URL}/flashcards`);
      setFlashcards(res.data.flashcards || []);
      setCardIndex(0);
      setIsFlipped(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Export & Save Note to SQLite Database
  const handleExportToNotepad = async (text: string, index: number) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: `Saved Answer ${notes.length + 1}`,
      content: text,
    };

    try {
      await axios.post(`${API_URL}/db/notes`, newNote);
      setNotes((prev) => [newNote, ...prev]);
      setExportedIndex(index);
      setTimeout(() => setExportedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to persist note", err);
    }
  };

  const handleSaveNote = async () => {
    if (!currentNoteContent.trim() && !noteTitle.trim()) return;

    let targetNote: Note;

    if (selectedNoteId) {
      targetNote = {
        id: selectedNoteId,
        title: noteTitle.trim() || "Untitled Note",
        content: currentNoteContent,
      };
      setNotes((prev) => prev.map((n) => (n.id === selectedNoteId ? targetNote : n)));
    } else {
      targetNote = {
        id: Date.now().toString(),
        title: noteTitle.trim() || `Untitled Note ${notes.length + 1}`,
        content: currentNoteContent,
      };
      setNotes((prev) => [targetNote, ...prev]);
      setSelectedNoteId(targetNote.id);
    }

    try {
      await axios.post(`${API_URL}/db/notes`, targetNote);
    } catch (err) {
      console.error("Failed to save note to DB", err);
    }

    setActiveHighlightTerm("");
  };

  const handleCreateNewNote = () => {
    setSelectedNoteId(null);
    setNoteTitle("");
    setCurrentNoteContent("");
    setActiveHighlightTerm("");
    setActiveTab("notes");
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/db/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setNoteTitle("");
        setCurrentNoteContent("");
        setActiveHighlightTerm("");
      }
    } catch (err) {
      console.error("Failed to delete note from DB", err);
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    setNoteTitle(note.title);
    setCurrentNoteContent(note.content);
    setActiveTab("notes");
    setSidebarOpen(false);

    if (searchQuery.trim()) {
      setActiveHighlightTerm(searchQuery.trim());
      setTimeout(() => {
        const mark = editorRef.current?.querySelector("mark");
        if (mark) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    } else {
      setActiveHighlightTerm("");
    }
  };

  const renderHighlightedContent = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={i} className="bg-yellow-400 text-black font-semibold px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#131314] text-[#e3e2e6] font-sans flex flex-col">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#1e1e20] transition-transform duration-300 ease-in-out flex flex-col justify-between p-4 shadow-2xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="font-medium text-base text-white tracking-tight">Study.ai</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 hover:bg-[#2d2d30] rounded-full text-slate-400 hover:text-white transition"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => { setMessages([]); setActiveTab("chat"); setSidebarOpen(false); }}
              className="flex items-center justify-center gap-1.5 bg-[#2b2b2e] hover:bg-[#353539] text-slate-200 rounded-full py-2 text-xs font-medium transition"
            >
              <PlusCircle className="h-3.5 w-3.5 text-indigo-400" /> New Chat
            </button>
            <button
              onClick={() => { handleCreateNewNote(); setSidebarOpen(false); }}
              className="flex items-center justify-center gap-1.5 bg-[#2b2b2e] hover:bg-[#353539] text-slate-200 rounded-full py-2 text-xs font-medium transition"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-400" /> New Note
            </button>
          </div>

          <nav className="flex gap-2 mb-4 p-1 bg-[#28282b] rounded-xl">
            <button
              onClick={() => { setActiveTab("chat"); setSidebarOpen(false); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                activeTab === "chat" ? "bg-[#004a77] text-[#c2e7ff]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Workspace
            </button>
            <button
              onClick={() => { setActiveTab("notes"); setSidebarOpen(false); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                activeTab === "notes" ? "bg-[#004a77] text-[#c2e7ff]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Notepad
            </button>
          </nav>

          <div className="mb-4 px-1">
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
              Document Tools
            </h3>
            <label className="flex items-center gap-2 p-2.5 bg-[#28282b] hover:bg-[#313135] rounded-xl cursor-pointer transition mb-2">
              <Upload className="h-4 w-4 text-indigo-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 font-medium truncate">
                {uploadedFile ? uploadedFile : "Upload PDF"}
              </span>
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            </label>
            {uploading && <p className="text-xs text-amber-400 mb-2 animate-pulse">{uploadStatus}</p>}
            {!uploading && uploadStatus && (
              <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {uploadStatus}
              </p>
            )}

            {uploadedFile && (
              <div className="space-y-2">
                <button
                  onClick={() => { handleSummarize(); setSidebarOpen(false); }}
                  disabled={loading}
                  className="w-full flex items-center gap-2 bg-[#28282b] hover:bg-[#313135] text-slate-300 rounded-xl px-3 py-2 text-xs font-medium transition"
                >
                  <Sparkles className="h-4 w-4 text-indigo-400" /> Summarize Document
                </button>

                <button
                  onClick={handleGenerateFlashcards}
                  disabled={loading}
                  className="w-full flex items-center gap-2 bg-[#28282b] hover:bg-[#313135] text-slate-300 rounded-xl px-3 py-2 text-xs font-medium transition"
                >
                  <Layers className="h-4 w-4 text-amber-400" /> Generate Flashcards
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 border-t border-[#2e2f33] pt-3">
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 px-1">
              Search Notes ({filteredNotes.length})
            </h3>

            <div className="relative mb-2.5 px-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search notes (e.g. OS)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#28282b] border border-[#38383c] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredNotes.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No saved notes.</p>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`group p-2.5 rounded-xl text-xs cursor-pointer transition border relative flex items-start justify-between gap-2 ${
                      selectedNoteId === note.id
                        ? "bg-[#28282b] border-indigo-500/50 text-white"
                        : "bg-[#28282b]/40 border-transparent text-slate-300 hover:bg-[#28282b]"
                    }`}
                  >
                    <div className="overflow-hidden flex-1">
                      <h4 className="font-medium text-slate-100 truncate">{note.title}</h4>
                      <p className="line-clamp-1 text-[11px] text-slate-400 mt-0.5">
                        {note.content}
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      className="p-1 text-slate-500 hover:text-red-400 rounded transition opacity-0 group-hover:opacity-100"
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Screen */}
      <div className="flex-1 flex flex-col min-h-screen w-full relative bg-[#131314]">
        <header className="sticky top-0 h-14 flex items-center justify-between px-6 bg-[#131314]/90 backdrop-blur z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#1e1e20] rounded-full text-slate-400 hover:text-white transition flex items-center gap-2 text-xs"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="text-slate-400 font-medium">Menu & Notes</span>
          </button>

          {uploadedFile && (
            <span className="text-xs text-slate-300 bg-[#1e1e20] px-3 py-1 rounded-full flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> {uploadedFile}
            </span>
          )}
        </header>

        {activeTab === "chat" ? (
          <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pb-24">
            <div className="flex-1 space-y-6 py-4">
              {messages.length === 0 ? (
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center text-slate-400">
                  <h2 className="text-3xl font-normal text-[#e3e2e6] mb-3">Hello, Scholar</h2>
                  <p className="text-sm max-w-sm text-slate-400 font-light">
                    Upload your PDF material or ask a question to begin.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className="w-full">
                    {m.role === "user" ? (
                      <div className="flex justify-end my-4">
                        <div className="bg-[#282a2c] text-[#e3e2e6] px-5 py-2.5 rounded-full text-sm max-w-xl">
                          {m.text}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-[#e3e2e6] w-full">
                        <div className="prose prose-invert max-w-none text-slate-200 space-y-4 text-[15px] leading-relaxed">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>

                        {/* Collapsible Source Citation Inspector */}
                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-4 border-t border-[#2e2f33] pt-3">
                            <button
                              onClick={() => setOpenSourceIndex(openSourceIndex === idx ? null : idx)}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-300 transition font-medium"
                            >
                              <FileSearch className="h-3.5 w-3.5 text-indigo-400" />
                              <span>View Sources ({m.sources.length})</span>
                              {openSourceIndex === idx ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {openSourceIndex === idx && (
                              <div className="mt-3 space-y-2 bg-[#1e1e20] p-4 rounded-2xl border border-[#2e2f33]">
                                {m.sources.map((src, sIdx) => (
                                  <div key={sIdx} className="text-xs text-slate-300 leading-relaxed bg-[#28282b] p-3 rounded-xl">
                                    <span className="font-semibold text-indigo-400 block mb-1">
                                      Excerpt #{sIdx + 1}
                                    </span>
                                    {src}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(m.text, idx)}
                            className="p-1.5 hover:bg-[#282a2c] text-slate-400 hover:text-slate-200 rounded-lg transition flex items-center gap-1.5 text-xs"
                            title="Copy response"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="h-4 w-4 text-emerald-400" />
                                <span className="text-emerald-400 text-xs">Copied</span>
                              </>
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleExportToNotepad(m.text, idx)}
                            className="p-1.5 hover:bg-[#282a2c] text-slate-400 hover:text-slate-200 rounded-lg transition flex items-center gap-1.5 text-xs"
                            title="Export to Notepad"
                          >
                            {exportedIndex === idx ? (
                              <>
                                <Check className="h-4 w-4 text-emerald-400" />
                                <span className="text-emerald-400 text-xs">Exported to Note</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="h-4 w-4" />
                                <span>+ Note</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="text-xs text-slate-400 animate-pulse flex items-center gap-2 py-2">
                  <Sparkles className="h-4 w-4 text-indigo-400 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent py-4 z-10">
              <div className="max-w-3xl mx-auto px-4">
                <div className="flex items-center bg-[#1e1e20] rounded-full px-5 py-2.5 border border-[#2e2f33] focus-within:border-slate-600 transition w-full shadow-lg">
                  <input
                    type="text"
                    placeholder="Ask Gemini or search uploaded PDF..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendQuery()}
                    className="flex-1 bg-transparent text-sm text-[#e3e2e6] placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSendQuery}
                    disabled={loading}
                    className="p-2 text-slate-300 hover:text-white transition disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "flashcards" ? (
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
            <h2 className="text-xl font-normal text-slate-100 mb-6 flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-400" /> Study Flashcards
            </h2>

            {loading ? (
              <div className="text-slate-400 text-sm animate-pulse flex items-center gap-2 py-12">
                <Sparkles className="h-5 w-5 text-amber-400 animate-spin" /> Generating flashcards from PDF...
              </div>
            ) : flashcards.length === 0 ? (
              <p className="text-slate-500 text-sm">No flashcards generated yet. Upload a PDF and try again.</p>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full min-h-[260px] bg-[#1e1e20] border border-[#2e2f33] hover:border-slate-600 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-xl relative group"
                >
                  <span className="absolute top-4 left-6 text-xs text-slate-500 font-medium">
                    {isFlipped ? "ANSWER" : "QUESTION"}
                  </span>

                  <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-medium px-4">
                    {isFlipped ? flashcards[cardIndex].answer : flashcards[cardIndex].question}
                  </p>

                  <div className="absolute bottom-4 right-6 text-xs text-slate-500 flex items-center gap-1 group-hover:text-amber-400 transition">
                    <RotateCw className="h-3.5 w-3.5" /> Click to flip
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-6">
                  <button
                    disabled={cardIndex === 0}
                    onClick={() => { setCardIndex((prev) => prev - 1); setIsFlipped(false); }}
                    className="p-3 bg-[#1e1e20] border border-[#2e2f33] hover:border-slate-600 rounded-full text-slate-300 disabled:opacity-30 transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <span className="text-xs text-slate-400 font-medium">
                    {cardIndex + 1} of {flashcards.length}
                  </span>

                  <button
                    disabled={cardIndex === flashcards.length - 1}
                    onClick={() => { setCardIndex((prev) => prev + 1); setIsFlipped(false); }}
                    className="p-3 bg-[#1e1e20] border border-[#2e2f33] hover:border-slate-600 rounded-full text-slate-300 disabled:opacity-30 transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 flex flex-col">
            <input
              type="text"
              placeholder="Note Title (Press Enter to save)..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
              className="bg-[#1e1e20] border border-[#2e2f33] rounded-xl px-5 py-3 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none mb-3"
            />

            {activeHighlightTerm ? (
              <div
                ref={editorRef}
                className="min-h-[400px] bg-[#1e1e20] border border-[#2e2f33] rounded-2xl p-6 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-4"
              >
                {renderHighlightedContent(currentNoteContent, activeHighlightTerm)}
              </div>
            ) : (
              <textarea
                placeholder="Type or paste your study notes here..."
                value={currentNoteContent}
                onChange={(e) => setCurrentNoteContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    handleSaveNote();
                  }
                }}
                className="min-h-[400px] bg-[#1e1e20] border border-[#2e2f33] rounded-2xl p-6 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-y mb-4 leading-relaxed"
              />
            )}

            <div className="flex items-center gap-3 pb-8">
              <button
                onClick={handleSaveNote}
                className="flex items-center gap-2 bg-[#004a77] text-[#c2e7ff] px-6 py-2.5 rounded-full text-xs font-medium transition"
              >
                <Save className="h-4 w-4" /> Save Note
              </button>
              {activeHighlightTerm && (
                <button
                  onClick={() => setActiveHighlightTerm("")}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Edit Note
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}