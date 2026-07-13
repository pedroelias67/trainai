"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) return;
    }

    // Only show on mobile
    if (window.innerWidth >= 768) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa_dismissed", Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[var(--bg-card)] border-t border-[var(--border)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📱</span>
        <p className="text-sm text-[var(--text-secondary)]">Instala o TrainAI no teu telemóvel</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-green-500 hover:bg-green-400 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
