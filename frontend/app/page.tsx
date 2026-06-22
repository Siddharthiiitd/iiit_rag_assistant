"use client";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";


type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; page: number }[];
  source_type?: string;
  time?: string;
};

const SUGGESTED = [
  "What is the attendance policy?",
  "Explain the grading scheme",
  "Graduation credit requirements?",
  "How does branch change work?",
];

const PROCESS_STEPS = [
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    label: "PDF Parsing", desc: "PyMuPDF extracts text from each page of the document",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    label: "Chunking", desc: "500-token overlapping chunks via LangChain",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    label: "Embedding", desc: "Gemini Embedding 001 converts chunks to vectors",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
    label: "ChromaDB", desc: "Vectors stored with source and page metadata",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    label: "Semantic Search", desc: "Query matched via cosine similarity",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
      </svg>
    ),
    label: "CRAG Check", desc: "Relevance scored — irrelevant = graceful fallback",
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    label: "Gemini 2.0 Flash", desc: "Generates grounded answer from retrieved context",
  },
];

function getTime() {
  if (typeof window === "undefined") return "";
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SourcesTab({ sources }: { sources: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? sources : sources.slice(0, 3);

  return (
    <div>
      <p style={{ fontSize: 10, color: "#849495", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Loaded Documents
      </p>
      {sources.length === 0 ? (
        <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(0,219,233,0.05)", border: "1px solid rgba(0,219,233,0.1)", color: "#b9cacb", fontSize: 11, lineHeight: 1.5 }}>
          No documents loaded yet. Make sure the backend is running and docs are ingested.
        </div>
      ) : (
        <>
          {visible.map((src, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 6, background: "rgba(0,219,233,0.04)", border: "1px solid rgba(0,219,233,0.1)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00dbe9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
              </svg>
              <span style={{ fontSize: 11, color: "#b9cacb", lineHeight: 1.4, wordBreak: "break-word" }}>{src}</span>
            </div>
          ))}
          {sources.length > 3 && (
            <button onClick={() => setExpanded(!expanded)}
              style={{ width: "100%", padding: "8px", borderRadius: 10, marginTop: 2, background: "transparent", border: "1px dashed rgba(0,219,233,0.2)", color: "#00dbe9", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {expanded ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                  Show less
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  Show {sources.length - 3} more
                </>
              )}
            </button>
          )}
          <p style={{ fontSize: 10, color: "#3b494b", marginTop: 10, textAlign: "center" }}>
            {sources.length} documents loaded
          </p>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm the IIIT Delhi academic assistant. Ask me anything about regulations, grading, attendance, or placement policies.",
      source_type: "documents",
    },
  ]);

  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/sources`)
      .then((r) => r.json())
      .then((data) => setSources(Array.isArray(data.sources) ? data.sources : []))
      .catch(() => setSources([]));
  }, []);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"sources" | "process" | "contact">("sources");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const question = text || input;
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: "user", content: question, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        source_type: data.source_type,
        time: getTime(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Could not reach the backend. Make sure the server is running.",
        source_type: "irrelevant",
        time: getTime(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const showSuggested = messages.length === 1;

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#051424", color: "#d4e4fa", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>IIITD Assistant</p>
          <p style={{ fontSize: 12, color: "#849495" }}>Loading interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#051424", color: "#d4e4fa", fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden", position: "relative" }}>

      {/* Ambient glow orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,219,233,0.13) 0%, transparent 70%)", top: -100, left: -100 }} />
        <div style={{ position: "absolute", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(87,27,193,0.16) 0%, transparent 70%)", bottom: 0, right: -80 }} />
        <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,219,233,0.06) 0%, transparent 70%)", top: "45%", left: "45%", transform: "translate(-50%,-50%)" }} />
      </div>

      {/* ── SIDEBAR ── */}
      {sidebarOpen && (
        <aside style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", background: "rgba(10,24,40,0.85)", backdropFilter: "blur(16px)", borderRight: "1px solid rgba(0,219,233,0.1)", zIndex: 20, position: "relative" }}>

          {/* Sidebar header */}
          <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/iiitd.png" alt="IIIT Delhi" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 12px rgba(0,219,233,0.35)", border: "1.5px solid rgba(0,219,233,0.3)" }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#d4e4fa" }}>IIITD Assistant</p>
                <p style={{ fontSize: 10, color: "#22c55e" }}>● Online</p>
              </div>
            </div>
          </div>

          {/* Tabs — SVG icons */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {(["sources", "process", "contact"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer", color: activeTab === tab ? "#00dbe9" : "#849495", borderBottom: activeTab === tab ? "2px solid #00dbe9" : "2px solid transparent", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {tab === "sources" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                )}
                {tab === "process" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/>
                  </svg>
                )}
                {tab === "contact" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px", scrollbarWidth: "none" }}>

            {activeTab === "sources" && <SourcesTab sources={sources} />}

            {activeTab === "process" && (
              <div>
                <p style={{ fontSize: 10, color: "#849495", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>How it works</p>
                {PROCESS_STEPS.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14, position: "relative" }}>
                    {i < PROCESS_STEPS.length - 1 && (
                      <div style={{ position: "absolute", left: 14, top: 28, width: 1, height: "calc(100% + 2px)", background: "rgba(0,219,233,0.15)" }} />
                    )}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(0,219,233,0.1)", border: "1px solid rgba(0,219,233,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {step.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#00dbe9", marginBottom: 2 }}>{step.label}</p>
                      <p style={{ fontSize: 10, color: "#849495", lineHeight: 1.5 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "contact" && (
              <div>
                <p style={{ fontSize: 10, color: "#849495", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Contact</p>
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <img src="/iiitd.png" alt="IIIT Delhi" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", boxShadow: "0 0 16px rgba(0,219,233,0.3)" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#d4e4fa" }}>Siddharth</p>
                  <p style={{ fontSize: 11, color: "#849495", marginTop: 2 }}>BTech CSAM · IIIT Delhi</p>
                  <p style={{ fontSize: 10, color: "#3b494b", marginTop: 2 }}>2nd Year · Batch 2028</p>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    {
                      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#849495" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>,
                      label: "GitHub", value: "github.com/Siddharthiiitd"
                    },
                    {
                      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#849495" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                      label: "Email", value: "siddharth24554@iiitd.ac.in"
                    },
                    {
                      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#849495" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
                      label: "Project", value: "iiitd-rag-assistant"
                    },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p style={{ fontSize: 9, color: "#3b494b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                        {item.icon} {item.label}
                      </p>
                      <p style={{ fontSize: 11, color: "#b9cacb" }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collapse button */}
          <button onClick={() => setSidebarOpen(false)}
            style={{ padding: "10px", fontSize: 11, color: "#3b494b", background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            collapse
          </button>
        </aside>
      )}

      {/* ── MAIN CHAT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 10, minWidth: 0 }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,20,36,0.75)", backdropFilter: "blur(12px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ background: "transparent", border: "none", color: "#849495", cursor: "pointer", marginRight: 4, display: "flex", alignItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            )}
            <img src="/iiitd.png" alt="IIIT Delhi" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 14px rgba(0,219,233,0.3)", border: "1.5px solid rgba(0,219,233,0.25)" }} />
            <div>
              <h1 style={{ fontSize: 14, fontWeight: 600, color: "#d4e4fa" }}>IIITD Assistant</h1>
              <p style={{ fontSize: 10, color: "#22c55e" }}>● Online</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#3b494b" }}>RAG + CRAG · Gemini 2.0 Flash</p>
        </header>

        {/* Messages */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 4, scrollbarWidth: "none" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>

            <p style={{ textAlign: "center", fontSize: 11, color: "#3b494b", marginBottom: 8 }}>Today</p>

            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "assistant" && (
                    <img src="/iiitd.png" alt="IIIT Delhi" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 0 10px rgba(0,219,233,0.3)", border: "1px solid rgba(0,219,233,0.25)" }} />
                  )}
                  <div style={{
                    maxWidth: "70%", position: "relative", wordBreak: "break-word",
                    ...(msg.role === "user" ? {
                      background: "linear-gradient(135deg, #00c6d4, #571bc1)",
                      borderRadius: "22px 22px 6px 22px",
                      padding: "10px 14px", fontSize: 14, lineHeight: 1.55, color: "white",
                      boxShadow: "0 4px 24px rgba(0,198,212,0.28), 0 0 40px rgba(87,27,193,0.12)",
                    } : {
                      background: "rgba(18,33,49,0.82)",
                      border: "1px solid rgba(0,219,233,0.15)",
                      borderRadius: "22px 22px 22px 6px",
                      padding: "12px 16px", fontSize: 14, lineHeight: 1.6, color: "#d4e4fa",
                      backdropFilter: "blur(8px)",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.35), 0 0 28px rgba(0,219,233,0.07)",
                    }),
                  }}>
                    {msg.role === "user" && (
                      <span style={{ position: "absolute", bottom: 0, right: -6, width: 12, height: 12, background: "#571bc1", clipPath: "polygon(0 0, 0 100%, 100% 100%)" }} />
                    )}
                    {msg.role === "assistant" && (
                      <span style={{ position: "absolute", bottom: 0, left: -6, width: 12, height: 12, background: "rgba(18,33,49,0.85)", clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                    )}
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && msg.source_type === "documents" && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <p style={{ fontSize: 10, color: "#849495", marginBottom: 6 }}>Sources</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {[...new Map(msg.sources.map((s) => [`${s.source}-${s.page}`, s])).values()].map((s, j) => (
                            <span key={j} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(0,219,233,0.08)", border: "1px solid rgba(0,219,233,0.2)", color: "#00dbe9", display: "flex", alignItems: "center", gap: 4 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {s.source} — p.{s.page}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {msg.time && (
                  <p style={{ fontSize: 10, color: "#3b494b", marginTop: 3, textAlign: msg.role === "user" ? "right" : "left", paddingLeft: msg.role === "assistant" ? 34 : 0, paddingRight: msg.role === "user" ? 4 : 0 }}>
                    {msg.time}{msg.role === "user" ? " · Delivered" : ""}
                  </p>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
                <img src="/iiitd.png" alt="IIIT Delhi" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 0 10px rgba(0,219,233,0.3)", border: "1px solid rgba(0,219,233,0.25)" }} />
                <div style={{ background: "rgba(18,33,49,0.82)", border: "1px solid rgba(0,219,233,0.15)", borderRadius: "22px 22px 22px 6px", padding: "12px 16px", backdropFilter: "blur(8px)", boxShadow: "0 0 20px rgba(0,219,233,0.08)", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(0,219,233,0.6)", display: "inline-block", animation: `bounce 1.4s ${delay}s infinite ease-in-out` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested prompts */}
            {showSuggested && !loading && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 20, border: "1px solid rgba(0,219,233,0.25)", background: "rgba(0,219,233,0.05)", color: "#00dbe9", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input */}
        <footer style={{ padding: "8px 16px 16px", background: "linear-gradient(to top, rgba(5,20,36,1) 70%, transparent)", position: "relative", zIndex: 10 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(18,33,49,0.85)", border: "1px solid rgba(0,219,233,0.2)", borderRadius: 28, padding: "8px 8px 8px 16px", backdropFilter: "blur(12px)", boxShadow: "0 0 28px rgba(0,219,233,0.1), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <input
                type="text" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about regulations, grading, attendance..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#d4e4fa", fontSize: 14 }}
              />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                style={{
                  width: 42, height: 42, borderRadius: "50%", border: "none",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  background: loading || !input.trim()
                    ? "rgba(0,219,233,0.08)"
                    : "linear-gradient(135deg, #00dbe9 0%, #0891b2 50%, #571bc1 100%)",
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: loading || !input.trim()
                    ? "none"
                    : "0 0 12px rgba(0,219,233,0.9), 0 0 24px rgba(0,219,233,0.5), 0 0 48px rgba(0,219,233,0.2), inset 0 1px 0 rgba(255,255,255,0.3)",
                  transition: "all 0.25s ease", flexShrink: 0,
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: 10, color: "#3b494b", marginTop: 8 }}>
              IIITD Assistant may summarize information. Always refer to official documents.
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
