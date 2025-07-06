"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import * as togeojson from "@tmcw/togeojson";
import type { MapContainerProps } from "react-leaflet";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
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

function PdfUploadBox() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploadType, setUploadType] = useState<'pdf' | 'gpx'>('pdf');
  const [lastGpxFile, setLastGpxFile] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setSuccess("");
    setError("");
    if (selected?.name.toLowerCase().endsWith('.gpx')) {
      setUploadType('gpx');
    } else {
      setUploadType('pdf');
    }
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
      if (file.name.toLowerCase().endsWith('.gpx')) {
        setLastGpxFile(file.name);
      }
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

function ChatBox({ apiKey, selectedFile, setSelectedFile }: { apiKey: string, selectedFile: string, setSelectedFile: (f: string) => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/files")
      .then(res => res.json())
      .then(data => setFiles(data.files || []));
  }, []);

  useEffect(() => {
    // Auto-scroll to latest message
    chatHistoryRef.current?.scrollTo({
      top: chatHistoryRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

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
    const now = formatTime(new Date());
    setMessages((msgs) => [...msgs, { role: "user", content: input, timestamp: now }]);
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
      let aiMessageAdded = false;
      const aiTimestamp = formatTime(new Date());
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantMessage += decoder.decode(value);
        setMessages((msgs) => {
          if (msgs[msgs.length - 1]?.role === "assistant") {
            return [
              ...msgs.slice(0, msgs.length - 1),
              { role: "assistant", content: assistantMessage, timestamp: aiTimestamp },
            ];
          } else {
            aiMessageAdded = true;
            return [...msgs, { role: "assistant", content: assistantMessage, timestamp: aiTimestamp }];
          }
        });
      }
      if (!aiMessageAdded) {
        setMessages((msgs) => [...msgs, { role: "assistant", content: assistantMessage, timestamp: aiTimestamp }]);
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
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
              <option key={f} value={f}>
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
                {msg.content}
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
          onClick={handleSend}
          disabled={loading || !input.trim() || !selectedFile}
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
  const [selectedFile, setSelectedFile] = useState<string>("");

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
        <div className={styles.leftBox}>
          <PdfUploadBox />
          {selectedFile && selectedFile.toLowerCase().endsWith('.gpx') ? (
            <GpxMapPreview fileName={selectedFile} />
          ) : (
            <div className={styles.gpxPreview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1976d2', fontWeight: 500, fontSize: 18, opacity: 0.7 }}>
              Map preview will appear here when a GPX file is selected
            </div>
          )}
        </div>
        <ChatBox apiKey={apiKey} selectedFile={selectedFile} setSelectedFile={setSelectedFile} />
      </div>
    </div>
  );
}
