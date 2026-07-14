"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "Como estou a progredir?",
  "Posso trocar o treino de amanhã?",
  "O que devo comer antes da corrida longa?",
  "Estou com dores nas pernas, o que faço?",
];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/plan", label: "Plano" },
  { href: "/dashboard/calendar", label: "Calendário" },
  { href: "/dashboard/fitness", label: "Fitness" },
  { href: "/dashboard/activities", label: "Atividades" },
  { href: "/dashboard/chat", label: "Chat IA" },
  { href: "/dashboard/profile", label: "Perfil" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        throw new Error("Erro na resposta");
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.content }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Desculpa, ocorreu um erro ao processar a tua pergunta. Tenta novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/chat"
                    ? "text-white bg-white/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 Chat com o Treinador IA
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Faz perguntas sobre o teu plano, treino ou nutrição</p>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 min-h-[300px]">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-sm shrink-0">
                  🤖
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[var(--text-secondary)] max-w-lg">
                  Olá! Sou o teu treinador de IA. Tenho acesso ao teu plano de treino e atividades recentes. Como posso ajudar-te hoje?
                </div>
              </div>

              <div>
                <p className="text-xs text-[var(--text-faint)] mb-2 ml-11">Sugestões:</p>
                <div className="ml-11 flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                msg.role === "user"
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-[var(--bg-hover)] border border-[var(--border-hover)]"
              }`}>
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div className={`rounded-2xl px-4 py-3 text-sm max-w-lg leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-green-500/10 border border-green-500/20 text-white rounded-tr-sm"
                  : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-hover)] flex items-center justify-center text-sm shrink-0">
                🤖
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreve a tua pergunta..."
            disabled={loading}
            className="flex-1 bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600
              focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all
              disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed
              text-black font-medium text-sm px-4 py-3 rounded-xl transition-colors shrink-0">
            Enviar
          </button>
        </form>
      </main>
    </div>
  );
}
