"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import Link from "next/link";

type User = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  athlete: {
    id: string;
    fitnessLevel: string | null;
    stravaConnected: boolean;
    trainingPlans: { id: string }[];
    _count: { activities: number };
  } | null;
};

type Invite = {
  id: string;
  token: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByUserId: string | null;
};

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  usersThisWeek: number;
  totalAthletes: number;
  activePlans: number;
  totalActivities: number;
  activitiesThisWeek: number;
  totalKm: number;
  stravaConnected: number;
  topAthletes: { id: string; name: string; activityCount: number; totalKm: number }[];
  registrationsByDay: { date: string; count: number }[];
};

type FeedItem = {
  type: "register" | "activity" | "plan";
  date: string;
  description: string;
  userName: string;
};

const fitnessLabels: Record<string, string> = {
  BEGINNER: "Iniciante", INTERMEDIATE: "Intermédio", ADVANCED: "Avançado", ELITE: "Elite",
};

function inviteStatus(invite: Invite): { label: string; color: string } {
  if (invite.usedAt) return { label: "Usado", color: "text-[var(--text-muted)]" };
  if (new Date(invite.expiresAt) < new Date()) return { label: "Expirado", color: "text-red-400" };
  return { label: "Pendente", color: "text-green-400" };
}

function relativeTime(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} hora${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days !== 1 ? "s" : ""}`;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "invites" | "stats" | "activity">("users");

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Invites state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const statsFetchedRef = useRef(false);

  // Activity feed state
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedFetchedRef = useRef(false);

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

  useEffect(() => {
    if (tab !== "invites") return;
    setInvitesLoading(true);
    fetch("/api/admin/invites")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setInvites(data); })
      .catch(() => {})
      .finally(() => setInvitesLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "stats" || statsFetchedRef.current) return;
    statsFetchedRef.current = true;
    setStatsLoading(true);
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "activity" || feedFetchedRef.current) return;
    feedFetchedRef.current = true;
    setFeedLoading(true);
    fetch("/api/admin/activity")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFeed(data); })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [tab]);

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

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setInvites((prev) => [data, ...prev]);
        setInviteEmail("");
      }
    } catch {}
    setCreatingInvite(false);
  }

  async function handleDeleteInvite(id: string) {
    const res = await fetch("/api/admin/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/auth/register?invite=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  const maxBarCount = stats
    ? Math.max(...stats.registrationsByDay.map((d) => d.count), 1)
    : 1;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LogoFull size={28} />
            <span className="text-[var(--text-faint)] text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border-hover)]">admin</span>
          </div>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 w-fit flex-wrap">
          {(["users", "invites", "stats", "activity"] as const).map((t) => {
            const labels = { users: "Utilizadores", invites: "Convites", stats: "Estatísticas", activity: "Atividade" };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? "bg-[#1f1f1f] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
                <p className="text-[var(--text-muted)] text-sm mt-0.5">{users.length} utilizador{users.length !== 1 ? "es" : ""} registado{users.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">{error}</div>
            )}

            {loading ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">A carregar…</div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="card">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-sm font-bold text-green-400 shrink-0">
                        {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                      </div>
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
                        <p className="text-[var(--text-muted)] text-xs">{user.email}</p>
                        <p className="text-[var(--text-faint)] text-xs mt-0.5">
                          Registado {new Date(user.createdAt).toLocaleDateString("pt-PT")}
                          {user.athlete && ` · ${user.athlete._count.activities} atividade${user.athlete._count.activities !== 1 ? "s" : ""}`}
                          {user.athlete?.fitnessLevel && ` · ${fitnessLabels[user.athlete.fitnessLevel] ?? user.athlete.fitnessLevel}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {user.athlete?.id && (
                          <Link
                            href={`/admin/athletes/${user.athlete.id}`}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] text-xs transition-all"
                          >
                            Ver detalhe →
                          </Link>
                        )}
                        <button
                          onClick={() => { setEditing(user); setEditName(user.name ?? ""); setEditEmail(user.email); }}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] text-xs transition-all">
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(user.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs transition-all">
                          Eliminar
                        </button>
                      </div>
                    </div>
                    {confirmDelete === user.id && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                        <p className="text-sm text-[var(--text-secondary)]">
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
          </>
        )}

        {/* ── INVITES TAB ── */}
        {tab === "invites" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Convites</h1>
                <p className="text-[var(--text-muted)] text-sm mt-0.5">{invites.length} convite{invites.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="card mb-6">
              <h2 className="text-sm font-semibold text-white mb-4">Criar convite</h2>
              <form onSubmit={handleCreateInvite} className="flex gap-3">
                <input
                  type="email"
                  className="input flex-1"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email (opcional — deixa vazio para convite genérico)"
                />
                <button type="submit" disabled={creatingInvite} className="btn-primary px-5 py-2.5 shrink-0">
                  {creatingInvite ? "A criar…" : "Criar convite"}
                </button>
              </form>
            </div>

            {invitesLoading ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">A carregar…</div>
            ) : invites.length === 0 ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">Nenhum convite criado ainda.</div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => {
                  const status = inviteStatus(invite);
                  return (
                    <div key={invite.id} className="card">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-medium">
                              {invite.email ?? "Convite genérico"}
                            </p>
                            <span className={`text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-[var(--text-faint)] text-xs mt-0.5">
                            Criado {new Date(invite.createdAt).toLocaleDateString("pt-PT")}
                            {" · "}Expira {new Date(invite.expiresAt).toLocaleDateString("pt-PT")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => copyInviteLink(invite.token)}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] text-xs transition-all"
                          >
                            {copiedToken === invite.token ? "Copiado ✓" : "Copiar link"}
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite.id)}
                            className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs transition-all"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
              <p className="text-[var(--text-muted)] text-sm mt-0.5">Visão geral da plataforma</p>
            </div>

            {statsLoading || !stats ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">A carregar…</div>
            ) : (
              <div className="space-y-4">
                {/* Row 1: 4 primary stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Utilizadores", value: stats.totalUsers },
                    { label: "Utilizadores Esta Semana", value: stats.usersThisWeek },
                    { label: "Atividades Esta Semana", value: stats.activitiesThisWeek },
                    { label: "Total km Treinados", value: `${stats.totalKm} km` },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                      <p className="text-[var(--text-muted)] text-xs">{s.label}</p>
                      <p className="text-white text-2xl font-bold mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Row 2: 3 secondary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                    <p className="text-[var(--text-muted)] text-xs">Planos Ativos</p>
                    <p className="text-white text-2xl font-bold mt-1">{stats.activePlans}</p>
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                    <p className="text-[var(--text-muted)] text-xs">Strava Ligado</p>
                    <p className="text-white text-2xl font-bold mt-1">{stats.stravaConnected}</p>
                    {stats.totalAthletes > 0 && (
                      <p className="text-[var(--text-faint)] text-xs mt-1">
                        {Math.round((stats.stravaConnected / stats.totalAthletes) * 100)}% dos atletas
                      </p>
                    )}
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                    <p className="text-[var(--text-muted)] text-xs">Email Verificado</p>
                    <p className="text-white text-2xl font-bold mt-1">{stats.verifiedUsers}</p>
                    {stats.totalUsers > 0 && (
                      <p className="text-[var(--text-faint)] text-xs mt-1">
                        {Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% dos utilizadores
                      </p>
                    )}
                  </div>
                </div>

                {/* Top athletes table */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-white mb-4">Top Atletas</h2>
                  {stats.topAthletes.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm">Sem dados ainda.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[var(--text-muted)] text-xs text-left border-b border-[var(--border)]">
                          <th className="pb-2 w-8">#</th>
                          <th className="pb-2">Nome</th>
                          <th className="pb-2 text-right">Atividades</th>
                          <th className="pb-2 text-right">Total km</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topAthletes.map((a, i) => (
                          <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="py-2.5 text-[var(--text-faint)] text-xs">{i + 1}</td>
                            <td className="py-2.5 text-[var(--text-secondary)]">{a.name}</td>
                            <td className="py-2.5 text-right text-[var(--text-secondary)]">{a.activityCount}</td>
                            <td className="py-2.5 text-right text-green-400 font-medium">{a.totalKm} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Bar chart: registrations last 30 days */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-white mb-4">Registos — últimos 30 dias</h2>
                  <div className="flex items-end gap-1 h-24">
                    {stats.registrationsByDay.map((d, i) => {
                      const heightPct = maxBarCount > 0 ? Math.round((d.count / maxBarCount) * 100) : 0;
                      const showLabel = i % 7 === 0;
                      return (
                        <div key={d.date} className="flex flex-col items-center flex-1 min-w-0">
                          <div className="w-full flex items-end h-20">
                            <div
                              className="w-full rounded-t-sm bg-green-500/60 hover:bg-green-500 transition-colors"
                              style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
                              title={`${d.date}: ${d.count} registo${d.count !== 1 ? "s" : ""}`}
                            />
                          </div>
                          {showLabel && (
                            <span className="text-[var(--text-faint)] text-[9px] mt-1 truncate w-full text-center">
                              {new Date(d.date).toLocaleDateString("pt-PT", { day: "numeric", month: "numeric" })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ACTIVITY FEED TAB ── */}
        {tab === "activity" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Atividade da Plataforma</h1>
              <p className="text-[var(--text-muted)] text-sm mt-0.5">Últimos 50 eventos</p>
            </div>

            {feedLoading ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">A carregar…</div>
            ) : feed.length === 0 ? (
              <div className="card text-center py-12 text-[var(--text-muted)] text-sm">Sem eventos recentes.</div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <div className="space-y-0">
                  {feed.map((item, i) => {
                    const dotColor =
                      item.type === "register"
                        ? "bg-green-500"
                        : item.type === "activity"
                        ? "bg-blue-500"
                        : "bg-purple-500";
                    const lineColor =
                      item.type === "register"
                        ? "bg-green-500/20"
                        : item.type === "activity"
                        ? "bg-blue-500/20"
                        : "bg-purple-500/20";
                    const isLast = i === feed.length - 1;
                    return (
                      <div key={i} className="flex gap-4">
                        {/* Timeline column */}
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                          {!isLast && <div className={`w-0.5 flex-1 ${lineColor} mt-1`} />}
                        </div>
                        {/* Content */}
                        <div className={`pb-4 flex-1 min-w-0 ${isLast ? "" : ""}`}>
                          <p className="text-[var(--text-secondary)] text-sm">{item.description}</p>
                          <p className="text-[var(--text-faint)] text-xs mt-0.5">{relativeTime(item.date)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
