"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sessionId: string;
  sessionDate: string; // ISO string
  isPriority: boolean;
  cancelled: boolean;
  onUpdate?: () => void;
};

const BTN =
  "border border-[var(--border-hover)] bg-[var(--bg-subtle)] rounded-xl px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all text-xs";

export function SessionActions({ sessionId, sessionDate, isPriority, cancelled, onUpdate }: Props) {
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [loading, setLoading] = useState<"priority" | "reschedule" | "cancel" | null>(null);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Erro ao guardar");
    onUpdate?.();
    router.refresh();
  }

  async function togglePriority() {
    setLoading("priority");
    try {
      await patch({ isPriority: !isPriority });
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  async function handleReschedule(e: React.ChangeEvent<HTMLInputElement>) {
    const dateValue = e.target.value; // "YYYY-MM-DD"
    if (!dateValue) return;
    setLoading("reschedule");
    setShowDatePicker(false);
    try {
      await patch({ date: new Date(dateValue).toISOString() });
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setLoading("cancel");
    setShowCancelConfirm(false);
    try {
      await patch({ cancelled: !cancelled });
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  // Format the current date for the default value of the date input
  const currentDateValue = sessionDate
    ? new Date(sessionDate).toISOString().slice(0, 10)
    : "";

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      {/* Priority toggle */}
      <button
        onClick={togglePriority}
        disabled={loading === "priority"}
        title={isPriority ? "Treino prioritário" : "Marcar como prioritário"}
        className={`${BTN} ${isPriority ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" : ""}`}
      >
        {isPriority ? "⭐" : "☆"}
      </button>

      {/* Reschedule button */}
      <div className="relative">
        <button
          onClick={() => { setShowDatePicker((v) => !v); setShowCancelConfirm(false); }}
          disabled={loading === "reschedule"}
          title="Reagendar treino"
          className={BTN}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showDatePicker && (
          <div className="absolute top-8 left-0 z-50 bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-xl p-2 shadow-xl">
            <input
              type="date"
              defaultValue={currentDateValue}
              onChange={handleReschedule}
              className="bg-transparent text-[var(--text-primary)] text-xs outline-none"
              autoFocus
              onBlur={() => setTimeout(() => setShowDatePicker(false), 200)}
            />
          </div>
        )}
      </div>

      {/* Cancel / Restore button */}
      {cancelled ? (
        <button
          onClick={handleCancel}
          disabled={loading === "cancel"}
          title="Restaurar treino"
          className={`${BTN} text-green-400 border-green-500/30 bg-green-500/5`}
        >
          ↩
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={() => { setShowCancelConfirm((v) => !v); setShowDatePicker(false); }}
            disabled={loading === "cancel"}
            title="Cancelar treino"
            className={BTN}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth={2}>
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showCancelConfirm && (
            <div className="absolute top-8 right-0 z-50 bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-xl p-3 shadow-xl whitespace-nowrap">
              <p className="text-xs text-[var(--text-secondary)] mb-2">Cancelar este treino?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all"
                >
                  Não
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
