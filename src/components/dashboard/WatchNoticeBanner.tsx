import Link from "next/link";
import type { WatchNotice } from "@/lib/connection-status";

/**
 * Tells the athlete their planned workouts are not reaching their watch.
 *
 * Worth a banner rather than a line in a settings page, because every other
 * signal says things are fine: activities arrive through Strava, the analysis
 * is written every Sunday, the plan looks complete. The one broken part is the
 * one nothing else mentions.
 */
export function WatchNoticeBanner({ notice }: { notice: WatchNotice | null }) {
  if (!notice) return null;

  const erro = notice.level === "error";
  const cores = erro
    ? "bg-red-500/5 border-red-500/20"
    : "bg-yellow-500/5 border-yellow-500/20";
  const marca = erro ? "text-red-400" : "text-yellow-400";

  const conteudo = (
    <>
      {notice.action.label}
      <span aria-hidden="true"> →</span>
    </>
  );

  return (
    <div className={`rounded-xl border p-4 ${cores}`}>
      <div className="flex gap-3">
        <span className={`shrink-0 text-base leading-none mt-0.5 ${marca}`} aria-hidden="true">
          {erro ? "⚠️" : "⌚"}
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-[var(--text-primary)]">{notice.title}</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{notice.detail}</p>
          {notice.action.external ? (
            <a
              href={notice.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-[var(--text-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {conteudo}
            </a>
          ) : (
            <Link
              href={notice.action.href}
              className="inline-block text-xs font-medium text-[var(--text-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {conteudo}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
