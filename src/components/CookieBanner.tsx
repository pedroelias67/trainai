"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie_consent", "accepted");
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
    setVisible(false);
  }

  function reject() {
    localStorage.setItem("cookie_consent", "essential");
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] p-4 md:p-6 md:bottom-4 md:left-4 md:right-auto md:max-w-sm">
      <div className="bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">🍪</span>
          <div>
            <p className="text-[var(--text-primary)] font-semibold text-sm mb-1">Utilizamos cookies</p>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed">
              Usamos apenas cookies essenciais para o funcionamento da aplicação (sessão, preferências).
              Não usamos cookies de publicidade ou rastreamento.{" "}
              <Link href="/privacy" className="text-green-400 hover:text-green-300 underline underline-offset-2">
                Política de Privacidade
              </Link>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black text-xs font-bold transition-colors"
          >
            Aceitar
          </button>
          <button
            onClick={reject}
            className="flex-1 py-2 rounded-xl border border-[var(--border-hover)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-all"
          >
            Só essenciais
          </button>
        </div>
      </div>
    </div>
  );
}
