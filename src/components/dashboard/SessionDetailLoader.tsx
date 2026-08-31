"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Plans are created as a skeleton, so a session opened before its week has been
 * written out has a title and targets but no coaching. This fetches that week's
 * detail on arrival — roughly seven seconds a session — and reloads the page.
 */
export function SessionDetailLoader({ weekId }: { weekId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Effects run twice in development; the request must not.
    if (started.current) return;
    started.current = true;

    fetch(`/api/weeks/${weekId}/detail`, { method: "POST" })
      .then(res => {
        if (!res.ok) throw new Error(String(res.status));
        router.refresh();
      })
      .catch(() => setFailed(true));
  }, [weekId, router]);

  if (failed) {
    return (
      <div className="card border-yellow-500/20 bg-yellow-500/5">
        <p className="text-sm text-[var(--text-secondary)]">
          Não foi possível preparar as orientações desta semana. Os alvos de distância e ritmo acima
          mantêm-se válidos — recarrega a página para tentar de novo.
        </p>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-4">
      <svg className="animate-spin w-5 h-5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
      </svg>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">A preparar as orientações desta semana…</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          O treinador IA está a escrever cada sessão. Demora cerca de um minuto, e só acontece uma vez.
        </p>
      </div>
    </div>
  );
}
