"use client";

import { useState } from "react";
import { WatchCompatibility } from "@/components/dashboard/WatchCompatibility";

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

export function WorkoutExportButton({ sessionId, weekId }: { sessionId: string; weekId: string }) {
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
          title="Exportar treino"
        >
          <DownloadIcon />
          {loading ? "A descarregar..." : "Exportar"}
        </button>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
              <h2 className="text-[var(--text-primary)] font-semibold text-base">Exportar treino</h2>
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

            <WatchCompatibility />

            <div className="flex gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="text-lg shrink-0">⚠️</span>
              <p><strong className="text-[var(--text-primary)]">O que ainda não é automático é o sentido inverso:</strong> enviar o treino planeado para o relógio. Nenhuma marca aceita este ficheiro por upload — só pelos seus próprios canais. O download serve para arquivo; para treinar, segue o método abaixo.</p>
            </div>

            {/* O que é este ficheiro */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">O que é este ficheiro</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Um <strong className="text-[var(--text-primary)]">treino planeado</strong>: aquecimento, série principal, retorno à calma, com alvos de pace ou de frequência cardíaca. Não é uma atividade já realizada — não tem GPS, tempos nem batimentos registados.
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Método universal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⌚</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Como fazer este treino <span className="text-green-400 text-xs font-normal">(qualquer relógio)</span></p>
              </div>
              {[
                { n: 1, text: 'Abre esta sessão no telemóvel — tens a estrutura, o pace-alvo e as zonas' },
                { n: 2, text: 'Se tiver séries, configura os intervalos no relógio (ex: 5x3min)' },
                { n: 3, text: 'Corre normalmente, com o relógio a registar' },
                { n: 4, text: 'Liga o Strava e a atividade volta sozinha para aqui, com análise' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{text}</p>
                </div>
              ))}
              <div className="flex gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/15 text-xs text-[var(--text-secondary)] leading-relaxed">
                <span className="shrink-0">✅</span>
                <p>O passo 4 é o que importa: o registo do treino chega cá automaticamente e alimenta o relatório semanal, independentemente da marca do relógio.</p>
              </div>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Garmin */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔵</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Garmin</p>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Já não precisas de ficheiros: liga o <strong className="text-[var(--text-primary)]">Intervals.icu</strong> no teu Perfil e cada semana do plano ganha um botão para enviar os treinos diretamente para o relógio. Serve igualmente para COROS, Suunto e Wahoo.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                A integração direta com a Garmin depende do programa de developers deles, que está suspenso por tempo indeterminado. A ponte não espera por isso.
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Huawei */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔴</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Huawei</p>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                O Huawei Health só sincroniza para o relógio os planos criados dentro dele, e não há forma de importar treinos de fora. Configura os intervalos no próprio relógio, em <em>Definições do modo de treino → Treino por intervalos</em>, e liga o Strava para o registo voltar para aqui:
              </p>
              {[
                { n: 1, text: 'Huawei Health → Eu → Gestão de privacidade' },
                { n: 2, text: 'Partilha de dados e autorização → Strava → Ligar' },
                { n: 3, text: 'Em Atividades, aqui na app, liga também o Strava' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{text}</p>
                </div>
              ))}
              <p className="text-xs text-[var(--text-muted)]">A ligação ao Strava só existe em alguns países, e só sincroniza corrida, caminhada e ciclismo ao ar livre — treinos indoor ficam de fora.</p>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Strava — não serve para treinos planeados */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-orange-400 shrink-0"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Strava <span className="text-red-400 text-xs font-normal">(não funciona)</span></p>
              </div>
              <div className="flex gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15 text-xs text-[var(--text-secondary)] leading-relaxed">
                <span className="shrink-0">🚫</span>
                <p>Não faças upload destes ficheiros no Strava — dá sempre <strong className="text-[var(--text-primary)]">&quot;Error Processing Data&quot;</strong>, porque o Strava só aceita atividades já realizadas. No sentido inverso continua a funcionar: regista o treino no relógio e ele aparece aqui sozinho.</p>
              </div>
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
