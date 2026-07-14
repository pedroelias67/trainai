"use client";

import { useState } from "react";

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth={2}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round"/>
  </svg>
);

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export function GarminExportButton({ sessionId, weekId }: { sessionId: string; weekId: string }) {
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState<"session" | "week" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadSession() {
    setError(null);
    setLoading("session");
    try {
      await triggerDownload(`/api/sessions/${sessionId}/export-tcx`, `trainai-treino.tcx`);
    } catch (e: any) {
      setError(e.message ?? "Erro ao descarregar");
    }
    setLoading(null);
  }

  async function downloadWeek() {
    setError(null);
    setLoading("week");
    try {
      await triggerDownload(`/api/weeks/${weekId}/export-tcx-zip`, `trainai-semana.zip`);
    } catch (e: any) {
      setError(e.message ?? "Erro ao descarregar");
    }
    setLoading(null);
  }

  return (
    <>
      {error && (
        <p className="text-xs text-red-400 mb-1">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowHelp(true)}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all text-xs font-medium disabled:opacity-50"
          title="Exportar para o Garmin"
        >
          <DownloadIcon />
          {loading ? "A descarregar..." : "Garmin"}
        </button>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-base">Como importar para o Garmin</h2>
              <button onClick={() => setShowHelp(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Export options */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadSession} disabled={loading !== null}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] hover:border-[var(--accent)] hover:bg-green-500/5 transition-all text-center disabled:opacity-50">
                <span className="text-2xl">🏃</span>
                <span className="text-sm font-semibold text-white">Este treino</span>
                <span className="text-xs text-[var(--text-muted)]">1 ficheiro .tcx</span>
              </button>
              <button onClick={downloadWeek} disabled={loading !== null}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] hover:border-[var(--accent)] hover:bg-green-500/5 transition-all text-center disabled:opacity-50">
                <span className="text-2xl">📅</span>
                <span className="text-sm font-semibold text-white">Semana inteira</span>
                <span className="text-xs text-[var(--text-muted)]">ZIP com todos os treinos</span>
              </button>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Phone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📱</span>
                <p className="text-sm font-semibold text-white">No telemóvel</p>
              </div>
              {[
                { n: 1, text: 'Descarrega "Este treino" ou "Semana inteira"' },
                { n: 2, text: 'Abre o ficheiro .tcx com a app Garmin Connect' },
                { n: 3, text: 'O treino é importado automaticamente como workout' },
                { n: 4, text: 'Sincroniza o relógio — o treino aparece em "Treinos"' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Computer */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💻</span>
                <p className="text-sm font-semibold text-white">No computador</p>
              </div>
              {[
                { n: 1, text: 'Descarrega "Este treino" ou extrai o ZIP da semana' },
                { n: 2, text: 'Vai a connect.garmin.com e faz login' },
                { n: 3, text: 'Menu "Treino" → "Workouts" → "Importar"' },
                { n: 4, text: 'Seleciona um ou vários ficheiros .tcx de uma vez' },
                { n: 5, text: 'Sincroniza o relógio via cabo ou app' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)]" />

            <div className="flex gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
              <span className="text-lg shrink-0">💡</span>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                No relógio, vai a <span className="text-white font-medium">Treino → Treinos Guardados</span> para iniciar o workout estruturado com os alvos de pace.
              </p>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
