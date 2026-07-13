"use client";

import { useState } from "react";

interface Shoe {
  id: string;
  name: string;
  brand: string | null;
  retired: boolean;
}

interface Props {
  activityId: string;
  currentShoeId: string | null;
  shoes: Shoe[];
}

export function ShoeSelector({ activityId, currentShoeId, shoes }: Props) {
  const [selectedShoeId, setSelectedShoeId] = useState(currentShoeId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeShoes = shoes.filter((s) => !s.retired);

  const handleSave = async () => {
    if (!selectedShoeId) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/shoes/${selectedShoeId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Sapatilhas</h2>
      {activeShoes.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Sem sapatilhas ativas.{" "}
          <a href="/dashboard/shoes" className="text-green-400 hover:text-green-300 underline">
            Adiciona uma sapatilha
          </a>
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <select
            value={selectedShoeId}
            onChange={(e) => setSelectedShoeId(e.target.value)}
            className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--border-strong)]"
          >
            <option value="">Sem sapatilha</option>
            {activeShoes.map((shoe) => (
              <option key={shoe.id} value={shoe.id}>
                {shoe.name}{shoe.brand ? ` (${shoe.brand})` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || !selectedShoeId}
            className="px-4 py-2.5 rounded-xl bg-green-500 text-black font-medium text-sm hover:bg-green-400 disabled:opacity-50 transition-colors shrink-0"
          >
            {saving ? "..." : saved ? "✓ Guardado" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
