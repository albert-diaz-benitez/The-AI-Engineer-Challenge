"use client";
import React, { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/chat";

const warmColors = {
  background: "#FFF8F0",
  userBubble: "#FFD6A5",
  assistantBubble: "#FFB4A2",
  border: "#E29578",
  input: "#FFE5D9",
  button: "#FFB4A2",
  buttonText: "#6D6875",
};

function ChatMessage({ message, role }: { message: string; role: string }) {
  return (
    <div
      style={{
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        background: role === "user" ? warmColors.userBubble : warmColors.assistantBubble,
        color: "#222",
        borderRadius: 16,
        padding: "8px 16px",
        margin: "4px 0",
        maxWidth: "70%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {message}
    </div>
  );
}

export default function ChatPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || !apiKey.trim()) return;
    setError("");
    setLoading(true);
    const userMessage = input;
    setMessages((msgs) => [...msgs, { role: "user", content: userMessage }]);
    setInput("");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message: "You are a helpful assistant.",
          user_message: userMessage,
          model,
          api_key: apiKey,
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
          // If last message is assistant, update it; else, add new
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: warmColors.background, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: 0 }}>
      <h1 style={{ color: warmColors.buttonText, margin: "32px 0 8px 0" }}>AI Chat</h1>
      <div style={{ background: "#fff", border: `2px solid ${warmColors.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontWeight: 500, color: warmColors.buttonText }}>
          OpenAI API Key:
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: `1px solid ${warmColors.border}`, background: warmColors.input }}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>
        <label style={{ fontWeight: 500, color: warmColors.buttonText }}>
          Model:
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: `1px solid ${warmColors.border}`, background: warmColors.input }}>
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
          </select>
        </label>
        <div ref={chatContainerRef} style={{ background: warmColors.input, borderRadius: 12, minHeight: 200, maxHeight: 320, overflowY: "auto", padding: 12, marginBottom: 8, display: "flex", flexDirection: "column" }}>
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg.content} role={msg.role} />
          ))}
        </div>
        {error && <div style={{ color: "#b00020", marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSend(); }}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${warmColors.border}`, background: warmColors.input }}
            placeholder="Type your message..."
            disabled={loading}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !apiKey.trim()}
            style={{ background: warmColors.button, color: warmColors.buttonText, border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s" }}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
      <footer style={{ marginTop: 32, color: warmColors.buttonText, fontSize: 14 }}>
        Powered by Next.js & FastAPI
      </footer>
    </div>
  );
}
