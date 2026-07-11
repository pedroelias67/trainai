"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import Link from "next/link";

type User = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  athlete: {
    fitnessLevel: string | null;
    stravaConnected: boolean;
    trainingPlans: { id: string }[];
    _count: { activities: number };
  } | null;
};

const fitnessLabels: Record<string, string> = {
  BEGINNER: "Iniciante", INTERMEDIATE: "Intermédio", ADVANCED: "Avançado", ELITE: "Elite",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (r) => {
        if (r.status === 403) { router.push("/dashboard"); return; }
        if (!r.ok) throw new Error("Erro ao carregar");
        return r.json();
      })
      .then((data) => { if (data) setUsers(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, email: editEmail }),
    });
    if (res.ok) {
      setUsers((u) => u.map((x) => x.id === editing.id ? { ...x, name: editName, email: editEmail } : x));
      setEditing(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((u) => u.filter((x) => x.id !== id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LogoFull size={28} />
            <span className="text-zinc-600 text-xs font-mono px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a]">admin</span>
          </div>
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{users.length} utilizador{users.length !== 1 ? "es" : ""} registado{users.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">{error}</div>
        )}

        {loading ? (
          <div className="card text-center py-12 text-zinc-500 text-sm">A carregar…</div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="card">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-sm font-bold text-green-400 shrink-0">
                    {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{user.name ?? "—"}</p>
                      {user.athlete?.trainingPlans.length ? (
                        <span className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">plano ativo</span>
                      ) : null}
                      {user.athlete?.stravaConnected && (
                        <span className="text-orange-400 text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Strava</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs">{user.email}</p>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      Registado {new Date(user.createdAt).toLocaleDateString("pt-PT")}
                      {user.athlete && ` · ${user.athlete._count.activities} atividade${user.athlete._count.activities !== 1 ? "s" : ""}`}
                      {user.athlete?.fitnessLevel && ` · ${fitnessLabels[user.athlete.fitnessLevel] ?? user.athlete.fitnessLevel}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditing(user); setEditName(user.name ?? ""); setEditEmail(user.email); }}
                      className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-zinc-400 hover:text-white hover:border-[#3a3a3a] text-xs transition-all">
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(user.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs transition-all">
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Confirm delete */}
                {confirmDelete === user.id && (
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a] flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      Tens a certeza? Esta ação é <span className="text-red-400 font-medium">irreversível</span> e elimina todos os dados do atleta.
                    </p>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={deleting === user.id}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all disabled:opacity-50">
                        {deleting === user.id ? "A eliminar…" : "Confirmar eliminação"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">Editar utilizador</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Nome</label>
                <input type="text" className="input" value={editName}
                  onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                {saving ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
