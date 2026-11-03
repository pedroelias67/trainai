"use client";

import { useState } from "react";

/**
 * Takes a copy of the data out of Supabase and into the admin's own machine.
 *
 * Deliberately a plain download rather than anything cleverer: it works from
 * any browser, on any day, with nothing installed, and the file that lands is
 * one an admin can open and read. The scheduled, complete, encrypted copy is a
 * script on a real machine — this is the one you can take right now.
 */
export function BackupButton() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function descarregar() {
    setWorking(true);
    setError(null);
    setFeito(null);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `A cópia falhou (${res.status})`);
      }

      const nome =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "trainai-backup.json";
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const kb = Math.round(blob.size / 1024);
      setFeito(`${nome} — ${kb} KB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--text-primary)] text-sm">Cópia de segurança</h2>
          <p className="text-[var(--text-muted)] text-xs mt-1 leading-relaxed max-w-xl">
            Descarrega todos os dados da aplicação num ficheiro — contas, planos, treinos,
            atividades, análises e recordes. Sem credenciais: ao restaurar, cada atleta volta a
            ligar o Strava e o relógio.
          </p>
        </div>
        <button
          onClick={descarregar}
          disabled={working}
          className="btn-primary text-xs py-2 shrink-0 disabled:opacity-50"
        >
          {working ? "A preparar…" : "Descarregar cópia"}
        </button>
      </div>

      {feito && (
        <p className="mt-3 text-xs text-green-400">
          Descarregado: {feito}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <p className="mt-3 text-[11px] text-[var(--text-faint)] leading-relaxed">
        Para a cópia completa — com esquema e credenciais, cifrada e automática todas as noites —
        corre <code className="text-[var(--text-muted)]">scripts/backup-db.sh</code> no Mac.
      </p>
    </div>
  );
}
