"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "bug",        label: "🐛 Bug / Erro",    desc: "Algo não está a funcionar" },
  { value: "suggestion", label: "💡 Sugestão",      desc: "Ideia para melhorar" },
  { value: "praise",     label: "⭐ Elogio",        desc: "Algo que gostaste" },
  { value: "question",   label: "❓ Questão",       desc: "Tenho uma dúvida" },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || message.trim().length < 5) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Erro ao enviar. Tenta novamente.");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setCategory("");
      setMessage("");
      setSent(false);
      setError("");
    }, 300);
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[var(--accent)] text-black shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        style={{ boxShadow: "0 4px 24px rgba(34,197,94,0.4)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal */}
          <div
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🙏</div>
                <h3 className="font-bold text-white text-lg mb-2">Obrigado pelo feedback!</h3>
                <p className="text-[var(--text-muted)] text-sm mb-5">Vamos analisar a tua mensagem e melhorar o TrainAI.</p>
                <button onClick={handleClose} className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-semibold">
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-white text-lg">Enviar feedback</h3>
                  <button type="button" onClick={handleClose} className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* Category */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        category === c.value
                          ? "border-[var(--accent)] bg-green-500/10"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)]">{c.label}</p>
                      <p className="text-xs text-[var(--text-faint)] mt-0.5">{c.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreve o que aconteceu ou o que gostarias de ver…"
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm p-3 resize-none focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-faint)]"
                />
                <p className="text-xs text-[var(--text-faint)] text-right mb-4">{message.length}/1000</p>

                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

                <button
                  type="submit"
                  disabled={!category || message.trim().length < 5 || sending}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {sending ? "A enviar…" : "Enviar feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
