"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

// ── Haptic feedback ───────────────────────────────────────────────────────────
export function haptic(style: "light" | "medium" | "heavy" = "light") {
  if ("vibrate" in navigator) {
    const patterns = { light: [10], medium: [20], heavy: [30, 10, 30] };
    navigator.vibrate(patterns[style]);
  }
}

// ── Nav order for swipe navigation ───────────────────────────────────────────
const NAV_ROUTES = [
  "/dashboard",
  "/dashboard/plan",
  "/dashboard/nutrition",
  "/dashboard/activities",
  "/dashboard/profile",
];

// ── Install prompt ────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Track visit count
    const visits = parseInt(localStorage.getItem("pwa_visits") ?? "0", 10) + 1;
    localStorage.setItem("pwa_visits", String(visits));

    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 14 * 24 * 60 * 60 * 1000) return;
    const installed = window.matchMedia("(display-mode: standalone)").matches;
    if (installed) return;
    if (window.innerWidth >= 768) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Show after 2nd visit
      if (visits >= 2) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    haptic("medium");
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem("pwa_dismissed", String(Date.now()));
    setShow(false);
    haptic("light");
  };

  return { show, install, dismiss };
}

// ── Pull-to-refresh ───────────────────────────────────────────────────────────
function usePullToRefresh(onRefresh: () => void) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullProgress, setPullProgress] = useState(0); // 0-1

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone && window.innerWidth >= 768) return;

    const THRESHOLD = 80;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        setPullProgress(Math.min(delta / THRESHOLD, 1));
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      if (pullProgress >= 1) {
        haptic("medium");
        onRefresh();
      }
      setPullProgress(0);
      pulling.current = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullProgress, onRefresh]);

  return pullProgress;
}

// ── Swipe navigation ──────────────────────────────────────────────────────────
function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    if (window.innerWidth >= 768) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;

      // Only horizontal swipes (more horizontal than vertical, min 60px)
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      const currentIndex = NAV_ROUTES.findIndex(r =>
        r === pathname || (r !== "/dashboard" && pathname.startsWith(r))
      );
      if (currentIndex === -1) return;

      if (dx < 0 && currentIndex < NAV_ROUTES.length - 1) {
        // Swipe left → next tab
        haptic("light");
        router.push(NAV_ROUTES[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right → previous tab
        haptic("light");
        router.push(NAV_ROUTES[currentIndex - 1]);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router]);
}

// ── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center animate-fade-out">
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-2xl shadow-green-500/30">
          <span className="text-4xl font-black text-black">T</span>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl tracking-tight">TrainAI</p>
          <p className="text-green-400 text-xs mt-0.5">O teu treinador pessoal</p>
        </div>
      </div>
      <div className="absolute bottom-12 flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main PWA Provider ─────────────────────────────────────────────────────────
export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { show: showInstall, install, dismiss } = useInstallPrompt();

  // Show splash only on first load in standalone mode
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const shown = sessionStorage.getItem("splash_shown");
    if (isStandalone && !shown) {
      setShowSplash(true);
      sessionStorage.setItem("splash_shown", "1");
    }
  }, []);

  // Register SW
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.location.reload();
  }, []);

  const pullProgress = usePullToRefresh(handleRefresh);
  useSwipeNavigation();

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* Pull-to-refresh indicator */}
      {pullProgress > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pointer-events-none"
          style={{ opacity: pullProgress }}
        >
          <div className={`w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent flex items-center justify-center transition-transform ${pullProgress >= 1 ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${pullProgress * 270}deg)` }}
          >
            {pullProgress >= 1 && (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </div>
        </div>
      )}

      {/* Refreshing overlay */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-green-500 animate-pulse" />
      )}

      {children}

      {/* Smart install banner */}
      {showInstall && (
        <div className="fixed bottom-20 left-4 right-4 z-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl flex items-center gap-3 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0">
            <span className="text-lg font-black text-black">T</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Instalar TrainAI</p>
            <p className="text-[var(--text-muted)] text-xs">Acesso rápido, funciona offline</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={install} className="px-3 py-1.5 bg-green-500 hover:bg-green-400 text-black text-xs font-bold rounded-lg transition-colors">
              Instalar
            </button>
            <button onClick={dismiss} className="text-[var(--text-faint)] hover:text-[var(--text-muted)] text-lg leading-none">×</button>
          </div>
        </div>
      )}
    </>
  );
}
