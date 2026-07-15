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
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
              <h2 className="text-[var(--text-primary)] font-semibold text-base">Exportar para o Garmin</h2>
              <button onClick={() => setShowHelp(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">

            {/* Export options */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadSession} disabled={loading !== null}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] hover:border-[var(--accent)] hover:bg-green-500/5 transition-all text-center disabled:opacity-50">
                <span className="text-2xl">🏃</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Este treino</span>
                <span className="text-xs text-[var(--text-muted)]">1 ficheiro .tcx</span>
              </button>
              <button onClick={downloadWeek} disabled={loading !== null}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] hover:border-[var(--accent)] hover:bg-green-500/5 transition-all text-center disabled:opacity-50">
                <span className="text-2xl">📅</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Semana inteira</span>
                <span className="text-xs text-[var(--text-muted)]">ZIP com todos os treinos</span>
              </button>
            </div>

            <div className="border-t border-[var(--border)]" />

            <div className="flex gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/15 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="text-lg shrink-0">✅</span>
              <p>Os ficheiros exportados são <strong className="text-[var(--text-primary)]">workouts estruturados</strong>. Após importação, aparecem em <strong className="text-[var(--text-primary)]">Treino → Treinos guardados</strong> no teu relógio Garmin.</p>
            </div>

            {/* Phone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📱</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Via app Garmin Connect (recomendado)</p>
              </div>
              {[
                { n: 1, text: 'Descarrega o ficheiro .tcx para o telemóvel' },
                { n: 2, text: 'Abre o ficheiro e escolhe "Abrir com Garmin Connect"' },
                { n: 3, text: 'A app importa automaticamente como treino estruturado' },
                { n: 4, text: 'Sincroniza o relógio — aparece em "Treinos guardados"' },
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
                <p className="text-sm font-semibold text-[var(--text-primary)]">Via Garmin Express (computador)</p>
              </div>
              {[
                { n: 1, text: 'Descarrega "Este treino" ou extrai o ZIP da semana' },
                { n: 2, text: 'Abre o Garmin Express e liga o relógio por USB' },
                { n: 3, text: 'Arrasta os ficheiros .tcx para a janela do Garmin Express' },
                { n: 4, text: 'Sincroniza — os treinos aparecem em "Treinos guardados" no relógio' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{text}</p>
                </div>
              ))}
            </div>

            </div>{/* end scrollable */}

            <div className="px-6 pb-5 pt-3 border-t border-[var(--border)] shrink-0">
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button
                onClick={() => setShowHelp(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
