"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  sessionId: string;
  initialNote: string | null;
}

export function SessionJournal({ sessionId, initialNote }: Props) {
  const [note, setNote] = useState(initialNote ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (value: string) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteNote: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [sessionId]);

  const handleChange = (value: string) => {
    setNote(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      save(value);
    }, 1000);
  };

  const handleBlur = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    save(note);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-yellow-400 text-sm">📝 A tua nota</h2>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-[var(--text-muted)]">A guardar...</span>}
          {saved && <span className="text-xs text-green-400">✓ Guardado</span>}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title="Editar nota"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {editing || !note ? (
        <div>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => { handleBlur(); if (note) setEditing(false); }}
            placeholder="Como correu o treino? Como te sentiste? Notas para o futuro..."
            rows={4}
            className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-strong)] resize-none"
          />
          {!note && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              + Adicionar nota
            </button>
          )}
        </div>
      ) : (
        <p
          className="text-sm text-[var(--text-secondary)] leading-relaxed cursor-pointer hover:text-[var(--text-primary)] transition-colors"
          onClick={() => setEditing(true)}
        >
          {note}
        </p>
      )}
    </div>
  );
}
