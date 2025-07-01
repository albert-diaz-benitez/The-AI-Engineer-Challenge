"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

function ChatMessage({ message, role, timestamp }: { message: string; role: string; timestamp: string }) {
  return (
    <div className={styles.messageRow} style={{ alignSelf: role === "user" ? "flex-end" : "flex-start" }}>
      <div className={styles.avatar}>{role === "user" ? "👤" : "🤖"}</div>
      <div className={styles.messageBubble}>
        <div>{message}</div>
        <div className={styles.timestamp}>{timestamp}</div>
      </div>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span style={{ marginLeft: 6, cursor: "pointer" }} title={text} aria-label="info">ℹ️</span>
  );
}

export default function ChatPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rememberApiKey, setRememberApiKey] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("onboardingDismissed")) {
      setShowOnboarding(true);
    }
    const storedKey = localStorage.getItem("openaiApiKey");
    if (storedKey) {
      setApiKey(storedKey);
      setRememberApiKey(true);
    }
  }, []);

  useEffect(() => {
    if (rememberApiKey && apiKey) {
      localStorage.setItem("openaiApiKey", apiKey);
    } else {
      localStorage.removeItem("openaiApiKey");
    }
  }, [rememberApiKey, apiKey]);

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("onboardingDismissed", "true");
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiKey.trim()) {
      setError("Please enter your OpenAI API key before sending a message.");
      return;
    }
    setError("");
    setLoading(true);
    const userMessage = input;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((msgs) => [...msgs, { role: "user", content: userMessage, timestamp: now }]);
    setInput("");
    try {
      const response = await fetch(API_URL as string, {
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
      const aiTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let aiMessageAdded = false;
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
    <div className={styles.pageContainer}>
      <div className={styles.headerBranding}>
        <Image src="/logo-ai-vibes.png" alt="AI Vibes Logo" width={40} height={40} className={styles.logo} />
        <span className={styles.brandName}>AI Vibes Chat</span>
      </div>
      {showOnboarding && (
        <div className={styles.onboardingTip}>
          <span>👋 Welcome! Enter your OpenAI API key to get started. <button onClick={handleDismissOnboarding} className={styles.dismissBtn}>Dismiss</button></span>
        </div>
      )}
      <div className={styles.chatBox}>
        <div style={{ background: "var(--chat-user-bg)", border: "2px solid var(--primary-blue)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontWeight: 500, color: "var(--button-text)" }}>
            OpenAI API Key:
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)" }}
              placeholder="sk-..."
              autoComplete="off"
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", fontSize: 14, color: "var(--button-text)", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={rememberApiKey}
              onChange={() => setRememberApiKey((v) => !v)}
              style={{ marginRight: 6 }}
            />
            Remember API key (stored only in your browser)
          </label>
          <label style={{ fontWeight: 500, color: "var(--button-text)" }}>
            Model:
            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)" }}>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
            <InfoTooltip text="Choose the AI model. gpt-4.1-mini is more advanced, gpt-3.5-turbo is faster and cheaper." />
          </label>
          <div ref={chatContainerRef} className={styles.chatContainer}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>💬</div>
                <div>Start the conversation!</div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={styles.fadeIn}>
                <ChatMessage message={msg.content} role={msg.role} timestamp={msg.timestamp} />
              </div>
            ))}
            {loading && (
              <div className={styles.messageRow} style={{ alignSelf: "flex-start" }}>
                <div className={styles.avatar}>🤖</div>
                <div className={styles.messageBubble}>
                  <span className={styles.loadingDots}>
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                  <div className={styles.timestamp}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )}
          </div>
          {error && <div className={styles.errorMsg}>{
            error.includes("key") ? "Please check your API key and try again." :
            error.includes("No response body") ? "No response from the server. Please try again later." :
            error.includes("fetch") ? "Network error. Please check your connection." :
            error
          }</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSend(); }}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)" }}
              placeholder="Type your message..."
              disabled={loading}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || !apiKey.trim()}
              style={{ background: "var(--button-bg)", color: "var(--button-text)", border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s" }}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
      <footer className={styles.footer}>
        <span>
          Made by <a href="https://github.com/albert-diaz-benitez" target="_blank" rel="noopener noreferrer">@albertdiaz</a> | Powered by Next.js & FastAPI
        </span>
        <span>
          <a href="https://github.com/albert-diaz-benitez/The-AI-Engineer-Challenge" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            <Image src="/github-mark.svg" alt="GitHub" width={20} height={20} style={{ verticalAlign: "middle" }} />
          </a>
        </span>
      </footer>
      <div className={styles.backgroundShape}></div>
    </div>
  );
}
