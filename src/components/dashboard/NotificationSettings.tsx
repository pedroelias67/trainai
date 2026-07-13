"use client";
import { useEffect, useState } from "react";
import { requestNotificationPermission } from "@/lib/notifications";

export default function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");

    if (granted && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: undefined,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      } catch {
        // Push subscription optional — notifications still work via Notification API
      }
    }
  };

  const statusLabel =
    permission === "granted" ? "Ativo" :
    permission === "denied" ? "Bloqueado" :
    "Inativo";

  const statusColor =
    permission === "granted" ? "text-green-400" :
    permission === "denied" ? "text-red-400" :
    "text-[var(--text-secondary)]";

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Notificações</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Estado: <span className={statusColor}>{statusLabel}</span>
          </p>
        </div>
        {permission !== "granted" && permission !== "denied" && (
          <button
            onClick={handleEnable}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-400 text-black text-xs font-semibold rounded-lg transition-colors"
          >
            Ativar notificações
          </button>
        )}
        {permission === "denied" && (
          <p className="text-xs text-[var(--text-faint)]">Ativa nas definições do browser</p>
        )}
      </div>
    </div>
  );
}
