"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";

function SettingsModal({ open, onClose, apiKey, setApiKey }: { open: boolean; onClose: () => void; apiKey: string; setApiKey: (k: string) => void }) {
  const [input, setInput] = useState(apiKey);
  useEffect(() => { setInput(apiKey); }, [apiKey, open]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.18)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 320, boxShadow: "0 4px 32px rgba(100,181,246,0.18)", position: "relative", display: "flex", flexDirection: "column", gap: 18 }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1976d2" }} aria-label="Close">×</button>
        <div style={{ fontWeight: 700, color: "#1976d2", fontSize: 20, marginBottom: 8 }}>API Key Settings</div>
        <label style={{ fontWeight: 500, color: "#1976d2" }}>
          OpenAI API Key:
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="sk-..."
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid #90caf9", background: "#f5faff", fontSize: 16 }}
            autoFocus
          />
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={() => { setApiKey(input); onClose(); }} className={styles.uploadButton} style={{ minWidth: 80 }}>Save</button>
          <button onClick={() => { setApiKey(""); setInput(""); localStorage.removeItem("openaiApiKey"); onClose(); }} className={styles.uploadButton} style={{ background: "#d32f2f", minWidth: 80 }}>Clear</button>
        </div>
        <div style={{ fontSize: 13, color: "#1976d2", marginTop: 4 }}>Your key is only stored in your browser.</div>
      </div>
    </div>
  );
}

function PdfUploadBox() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setSuccess("");
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file to upload.");
      return;
    }
    setUploading(true);
    setSuccess("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload_pdf", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Upload failed");
      }
      const data = await response.json();
      setSuccess(`Upload successful! Chunks uploaded: ${data.chunks_uploaded}`);
      setFile(null);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.uploadBox}>
      <div className={styles.uploadTitle}>Upload a PDF to the Vector Database</div>
      <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
      <button
        className={styles.uploadButton}
        onClick={handleUpload}
        disabled={uploading || !file}
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
      {success && <div className={styles.successMsg}>{success}</div>}
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.uploadHint}>
        Your PDF will be chunked and stored for semantic search!
      </div>
    </div>
  );
}

function ChatBox({ apiKey }: { apiKey: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch file list from backend
    fetch("/api/files")
      .then(res => res.json())
      .then(data => setFiles(data.files || []));
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiKey) {
      setError("Please set your OpenAI API key in settings before chatting.");
      return;
    }
    if (!selectedFile) {
      setError("Please select a file to use for context.");
      return;
    }
    setError("");
    setLoading(true);
    setMessages((msgs) => [...msgs, { role: "user", content: input }]);
    const userMessage = input;
    setInput("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: "You are a helpful assistant.",
          user_message: userMessage,
          model: "gpt-4.1-mini",
          api_key: apiKey,
          file_name: selectedFile,
        }),
      });
      if (!response.body) throw new Error("No response body");
      let assistantMessage = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantMessage += decoder.decode(value);
        setMessages((msgs) => {
          if (msgs[msgs.length - 1]?.role === "assistant") {
            return [
              ...msgs.slice(0, msgs.length - 1),
              { role: "assistant", content: assistantMessage },
            ];
          } else {
            return [...msgs, { role: "assistant", content: assistantMessage }];
          }
        });
      }
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        chatHistoryRef.current?.scrollTo({ top: chatHistoryRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <div className={styles.chatBox}>
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className={styles.chatTitle}>Chat with your Documents</div>
        <button onClick={() => window.dispatchEvent(new CustomEvent("openSettingsModal"))} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1976d2" }} aria-label="Settings">⚙️</button>
      </div>
      <div style={{ width: "100%", marginBottom: 12 }}>
        <label style={{ fontWeight: 600, color: "#1976d2", fontSize: "1.1rem" }}>
          Select file for context:
          <select
            value={selectedFile}
            onChange={e => setSelectedFile(e.target.value)}
            style={{ marginLeft: 12, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #90caf9", fontSize: "1.1rem", background: "#fff" }}
            required
          >
            <option value="" disabled>Select a file...</option>
            {files.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.chatHistory} ref={chatHistoryRef}>
        {messages.length === 0 && <div style={{ color: '#1976d2', opacity: 0.7 }}>Start the conversation!</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={styles.messageRow}>
            <div className={msg.role === "user" ? styles.userMsg : styles.assistantMsg}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className={styles.messageRow}>
            <div className={styles.assistantMsg}>...</div>
          </div>
        )}
      </div>
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.inputRow}>
        <input
          className={styles.inputField}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSend(); }}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={loading || !input.trim() || !selectedFile}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem("openaiApiKey");
    if (storedKey) setApiKey(storedKey);
    const openModal = () => setModalOpen(true);
    window.addEventListener("openSettingsModal", openModal);
    return () => window.removeEventListener("openSettingsModal", openModal);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("openaiApiKey", apiKey);
    else localStorage.removeItem("openaiApiKey");
  }, [apiKey]);

  return (
    <div className={styles.root}>
      <SettingsModal open={modalOpen} onClose={() => setModalOpen(false)} apiKey={apiKey} setApiKey={setApiKey} />
      <div className={styles.container}>
        <PdfUploadBox />
        <ChatBox apiKey={apiKey} />
      </div>
    </div>
  );
}
