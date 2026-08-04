export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-2xl font-bold text-white mb-2">Sem ligação</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs">
        Não foi possível ligar ao TrainAI. Verifica a tua ligação à internet e tenta novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold rounded-xl transition-colors"
      >
        Tentar novamente
      </button>
      <p className="text-[var(--text-faint)] text-xs mt-8">
        As páginas que visitaste recentemente podem estar disponíveis offline.
      </p>
    </div>
  );
}
