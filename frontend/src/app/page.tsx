"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import dynamic from "next/dynamic";

const GpxMapPreview = dynamic(() => import("./GpxMapPreview"), { ssr: false });

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

function PdfUploadBox({ refreshFiles }: { refreshFiles: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setSuccess("");
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF or GPX file to upload.");
      return;
    }
    setUploading(true);
    setSuccess("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.name.toLowerCase().endsWith('.gpx')
        ? "/api/upload_gpx"
        : "/api/upload_pdf";
      const response = await fetch(endpoint, {
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
      refreshFiles();
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || "Upload failed");
      } else {
        setError("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.uploadBox}>
      <div className={styles.uploadTitle}>Upload a PDF or GPX Route</div>
      <input
        type="file"
        accept="application/pdf,.pdf,.gpx,application/gpx+xml"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <button
        className={styles.uploadButton}
        onClick={handleUpload}
        disabled={uploading || !file}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
      {success && <div className={styles.successMsg}>{success}</div>}
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.uploadHint}>
        Your file will be chunked and stored for semantic search!
      </div>
    </div>
  );
}

function fileIcon(fileName: string) {
  if (fileName.toLowerCase().endsWith('.gpx')) return '🗺️';
  if (fileName.toLowerCase().endsWith('.pdf')) return '📄';
  return '📁';
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatBox({ apiKey, selectedFiles, setSelectedFiles, files }: { apiKey: string, selectedFiles: string[], setSelectedFiles: (f: string[]) => void, files: string[] }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    chatHistoryRef.current?.scrollTo({
      top: chatHistoryRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const handleSend = async () => {
    if (sending) {
      console.log("handleSend blocked: already sending");
      return;
    }
    setSending(true);
    console.log("handleSend called", { input, time: Date.now() });
    if (!input.trim()) { setSending(false); return; }
    if (!apiKey) { setError("Please set your OpenAI API key in settings before chatting."); setSending(false); return; }
    if (selectedFiles.length === 0 || !selectedFiles[0]) { setError("Please select at least one file to use for context."); setSending(false); return; }
    setError("");
    setLoading(true);
    const now = formatTime(new Date());
    setMessages((msgs) => {
      const trimmed = [...msgs];
      while (
        trimmed.length > 0 &&
        trimmed[trimmed.length - 1].role === "assistant" &&
        trimmed[trimmed.length - 1].content === "..."
      ) {
        trimmed.pop();
      }
      return [
        ...trimmed,
        { role: "user", content: input, timestamp: now },
        { role: "assistant", content: "...", timestamp: formatTime(new Date()) }
      ];
    });
    const userMessage = input;
    setInput("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: selectedFiles.length === 2
            ? "You are a helpful assistant. Compare the two selected GPX routes based on the user's question. Use the provided context for each route."
            : "You are a helpful assistant.",
          user_message: userMessage,
          model: "gpt-4.1-mini",
          api_key: apiKey,
          file_names: selectedFiles.filter(Boolean),
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
          if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            return [
              ...msgs.slice(0, msgs.length - 1),
              { ...msgs[msgs.length - 1], content: assistantMessage, timestamp: formatTime(new Date()) }
            ];
          }
          return msgs;
        });
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
      setSending(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    console.log("Input keydown", { key: e.key, sending });
    if (e.key === "Enter" && !e.shiftKey && !loading && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatHistoryRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.chatBox}>
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className={styles.chatTitle}>Chat with the Assistant</div>
        <button onClick={() => window.dispatchEvent(new CustomEvent("openSettingsModal"))} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1976d2" }} aria-label="Settings">⚙️</button>
      </div>
      <div style={{ width: "100%", marginBottom: 12 }}>
        <div style={{ color: '#1976d2', fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
          {selectedFiles[0] && selectedFiles[1] ? `Comparison mode: ${selectedFiles[0]} vs ${selectedFiles[1]}` : selectedFiles[0] ? `Single file: ${selectedFiles[0]}` : 'No file selected'}
        </div>
        <label style={{ fontWeight: 600, color: "#1976d2", fontSize: "1.1rem", display: 'block', marginBottom: 6 }}>
          Select first file for context:
          <select
            value={selectedFiles[0] || ""}
            onChange={e => {
              const newFiles = [e.target.value, selectedFiles[1] === e.target.value ? "" : selectedFiles[1]];
              setSelectedFiles(newFiles.filter(Boolean));
            }}
            style={{ marginLeft: 12, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #90caf9", fontSize: "1.1rem", background: "#fff", minWidth: 220 }}
            required
          >
            <option value="" disabled>Select a file...</option>
            {files.map(f => (
              <option key={f} value={f} disabled={selectedFiles[1] === f}>
                {fileIcon(f)} {f}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontWeight: 600, color: "#1976d2", fontSize: "1.1rem", display: 'block', marginBottom: 0 }}>
          Select second file for comparison (optional):
          <select
            value={selectedFiles[1] || ""}
            onChange={e => {
              const newFiles = [selectedFiles[0], e.target.value === selectedFiles[0] ? "" : e.target.value];
              setSelectedFiles(newFiles.filter(Boolean));
            }}
            style={{ marginLeft: 12, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #90caf9", fontSize: "1.1rem", background: "#fff", minWidth: 220 }}
          >
            <option value="" disabled>Select a file...</option>
            {files.map(f => (
              <option key={f} value={f} disabled={selectedFiles[0] === f}>
                {fileIcon(f)} {f}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.chatHistory} ref={chatHistoryRef}>
        {messages.length === 0 && <div style={{ color: '#1976d2', opacity: 0.7 }}>Start the conversation!</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={styles.messageRow} style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{msg.role === 'user' ? '🧑' : '🤖'}</span>
              <div className={msg.role === "user" ? styles.userMsg : styles.assistantMsg}>
                {msg.content === "..." ? (
                  <span className={styles.loadingDots}><span>.</span><span>.</span><span>.</span></span>
                ) : msg.content}
                <div style={{ fontSize: 12, color: '#888', marginTop: 4, textAlign: 'right' }}>{msg.timestamp}</div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.messageRow} style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>🤖</span>
              <div className={styles.assistantMsg}>
                <span className={styles.loadingDots}>
                  <span>.</span><span>.</span><span>.</span>
                </span>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4, textAlign: 'right' }}>{formatTime(new Date())}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.inputRow}>
        <textarea
          className={styles.inputField}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type your message..."
          disabled={loading}
          rows={2}
          style={{ resize: 'vertical', minHeight: 40, maxHeight: 120 }}
        />
        <button
          className={styles.sendButton}
          onClick={() => { console.log('Send button clicked', { sending }); if (!sending) handleSend(); }}
          disabled={loading || !input.trim() || !selectedFiles[0]}
        >
          {loading ? <span className={styles.loadingDots}><span>.</span><span>.</span><span>.</span></span> : "Send"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [files, setFiles] = useState<string[]>([]);

  const refreshFiles = () => {
    fetch("/api/files")
      .then(res => res.json())
      .then(data => setFiles(data.files || []));
  };

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

  useEffect(() => {
    setPreviewIndex(0);
  }, [selectedFiles]);

  useEffect(() => {
    refreshFiles();
  }, []);

  const selectedGpxFiles = selectedFiles.filter(f => f.toLowerCase().endsWith('.gpx'));

  return (
    <div className={styles.root}>
      <SettingsModal open={modalOpen} onClose={() => setModalOpen(false)} apiKey={apiKey} setApiKey={setApiKey} />
      <div className={styles.container}>
        <div className={styles.leftBox}>
          <PdfUploadBox refreshFiles={refreshFiles} />
          {selectedGpxFiles.length === 2 ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <button
                  onClick={() => setPreviewIndex(0)}
                  style={{
                    background: previewIndex === 0 ? '#1976d2' : '#e3f0fc',
                    color: previewIndex === 0 ? '#fff' : '#1976d2',
                    border: '1.5px solid #90caf9',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {selectedGpxFiles[0]}
                </button>
                <button
                  onClick={() => setPreviewIndex(1)}
                  style={{
                    background: previewIndex === 1 ? '#1976d2' : '#e3f0fc',
                    color: previewIndex === 1 ? '#fff' : '#1976d2',
                    border: '1.5px solid #90caf9',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {selectedGpxFiles[1]}
                </button>
              </div>
              <GpxMapPreview fileName={selectedGpxFiles[previewIndex]} />
            </>
          ) : selectedGpxFiles.length === 1 ? (
            <GpxMapPreview fileName={selectedGpxFiles[0]} />
          ) : (
            <div className={styles.gpxPreview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1976d2', fontWeight: 500, fontSize: 18, opacity: 0.7 }}>
              Map preview will appear here when a GPX file is selected
            </div>
          )}
        </div>
        <ChatBox apiKey={apiKey} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} files={files} />
      </div>
    </div>
  );
}
