"use client";

import { useState } from "react";

interface Props {
  defaultOpen: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
  weekId: string;
  zipHref: string;
  intervalsConnected?: boolean;
}

export function PlanWeekCollapsible({
  defaultOpen, header, children, weekId, zipHref, intervalsConnected = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [pushState, setPushState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushWarning, setPushWarning] = useState<string | null>(null);

  async function pushToWatch() {
    setPushState("loading");
    setPushError(null);
    setPushWarning(null);
    try {
      const res = await fetch("/api/intervals/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setPushWarning(data.warning ?? null);
      setPushState("done");
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Erro inesperado");
      setPushState("error");
    }
  }

  return (
    <div id={`week-${weekId}`}>
      <div className="flex items-center border-b border-[var(--border)]">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left px-5 py-4"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            {header}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 text-[var(--text-faint)] transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
        {intervalsConnected && (
          <button
            onClick={pushToWatch}
            disabled={pushState === "loading"}
            title={pushError ?? "Enviar semana para o relógio via Intervals.icu"}
            className={`flex items-center gap-1 px-3 py-1.5 mr-2 rounded-lg border transition-all text-xs shrink-0 disabled:opacity-50 ${
              pushState === "done"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : pushState === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {pushState === "loading" ? "A enviar…"
              : pushState === "done" ? (pushWarning ? "✓ Enviado" : "✓ No relógio")
              : pushState === "error" ? "Falhou"
              : "⌚ Enviar"}
          </button>
        )}
        <a
          href={zipHref}
          download
          title="Exportar semana em ficheiro"
          className="flex items-center gap-1 px-3 py-1.5 mr-3 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all text-xs shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round"/>
          </svg>
          ZIP
        </a>
      </div>
      {pushWarning && (
        <div className="flex gap-3 mx-3 my-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs text-[var(--text-secondary)] leading-relaxed">
          <span className="text-base shrink-0">⚠️</span>
          <p>
            {pushWarning}{" "}
            <a
              href="https://intervals.icu/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-primary)] underline underline-offset-2"
            >
              Abrir definições do Intervals.icu
            </a>
          </p>
        </div>
      )}
      {open && children}
    </div>
  );
}
