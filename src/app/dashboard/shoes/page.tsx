"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

interface Shoe {
  id: string;
  name: string;
  brand: string | null;
  color: string | null;
  totalKm: number;
  distanceLimit: number;
  retired: boolean;
  createdAt: string;
  _count: { activities: number };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/plan", label: "Plano" },
  { href: "/dashboard/calendar", label: "Calendário" },
  { href: "/dashboard/fitness", label: "Fitness" },
  { href: "/dashboard/activities", label: "Atividades" },
  { href: "/dashboard/shoes", label: "Sapatilhas" },
  { href: "/dashboard/zones", label: "Zonas" },
  { href: "/dashboard/chat", label: "Chat IA" },
  { href: "/dashboard/profile", label: "Perfil" },
];

function ProgressBar({ totalKm, distanceLimit }: { totalKm: number; distanceLimit: number }) {
  const pct = Math.min((totalKm / distanceLimit) * 100, 100);
  const color = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface ModalProps {
  shoe?: Shoe | null;
  onClose: () => void;
  onSave: () => void;
}

function ShoeModal({ shoe, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(shoe?.name ?? "");
  const [brand, setBrand] = useState(shoe?.brand ?? "");
  const [color, setColor] = useState(shoe?.color ?? "");
  const [distanceLimit, setDistanceLimit] = useState(shoe?.distanceLimit ?? 700);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = shoe ? `/api/shoes/${shoe.id}` : "/api/shoes";
      const method = shoe ? "PATCH" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brand, color, distanceLimit }),
      });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="font-bold text-white text-lg">{shoe ? "Editar sapatilha" : "Adicionar sapatilha"}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nike Vaporfly 3"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Marca</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ex: Nike"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Cor</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ex: Branco/Verde"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">
              Limite de distância: <span className="text-white font-medium">{distanceLimit} km</span>
            </label>
            <input
              type="range"
              min={400}
              max={1000}
              step={50}
              value={distanceLimit}
              onChange={(e) => setDistanceLimit(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-[var(--text-faint)] mt-1">
              <span>400 km</span>
              <span>1000 km</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-500 text-black font-medium text-sm hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {loading ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShoesPage() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editShoe, setEditShoe] = useState<Shoe | null>(null);

  const fetchShoes = useCallback(async () => {
    const res = await fetch("/api/shoes");
    const data = await res.json();
    setShoes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchShoes(); }, [fetchShoes]);

  const handleRetireToggle = async (shoe: Shoe) => {
    await fetch(`/api/shoes/${shoe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retired: !shoe.retired }),
    });
    fetchShoes();
  };

  const handleSave = () => {
    setShowModal(false);
    setEditShoe(null);
    fetchShoes();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/shoes"
                    ? "text-white bg-white/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">As minhas sapatilhas</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Regista o desgaste das tuas sapatilhas de corrida</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-500 text-black font-medium rounded-xl text-sm hover:bg-green-400 transition-colors"
          >
            + Adicionar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[var(--text-muted)]">A carregar...</div>
        ) : shoes.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-4xl mb-4">👟</div>
            <h2 className="text-lg font-bold text-white mb-2">Sem sapatilhas registadas</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">Adiciona as tuas sapatilhas para acompanhar o desgaste</p>
            <p className="text-[var(--text-faint)] text-xs">
              Como usar: adiciona sapatilhas aqui e atribui-as às atividades na página de detalhe de cada atividade.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shoes.map((shoe) => {
              const pct = (shoe.totalKm / shoe.distanceLimit) * 100;
              const nearLimit = shoe.totalKm > shoe.distanceLimit * 0.9;
              return (
                <div
                  key={shoe.id}
                  className={`card ${shoe.retired ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">{shoe.name}</h3>
                      {shoe.brand && <p className="text-[var(--text-muted)] text-xs mt-0.5">{shoe.brand}{shoe.color ? ` · ${shoe.color}` : ""}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditShoe(shoe); setShowModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          shoe.retired
                            ? "bg-zinc-800 text-[var(--text-secondary)]"
                            : "bg-green-500/10 text-green-400"
                        }`}
                      >
                        {shoe.retired ? "Reformada" : "Ativa"}
                      </span>
                    </div>
                  </div>

                  {nearLimit && !shoe.retired && (
                    <p className="text-xs text-yellow-400 mb-3">⚠️ Perto do limite</p>
                  )}

                  <ProgressBar totalKm={shoe.totalKm} distanceLimit={shoe.distanceLimit} />

                  <div className="flex items-center justify-between mt-2 mb-4">
                    <span className="text-sm font-medium text-white">
                      {shoe.totalKm.toFixed(0)} <span className="text-[var(--text-muted)]">/ {shoe.distanceLimit} km</span>
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">{shoe._count.activities} atividades</span>
                  </div>

                  <button
                    onClick={() => handleRetireToggle(shoe)}
                    className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-hover)] rounded-lg py-1.5 transition-colors"
                  >
                    {shoe.retired ? "Reativar" : "Reformar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)]">
            <span className="text-[var(--text-secondary)] font-medium">Como usar:</span> Atribui sapatilhas às atividades na página de detalhe de cada atividade (secção &quot;Sapatilhas&quot; no fundo da página).
          </p>
        </div>
      </main>

      {showModal && (
        <ShoeModal
          shoe={editShoe}
          onClose={() => { setShowModal(false); setEditShoe(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
