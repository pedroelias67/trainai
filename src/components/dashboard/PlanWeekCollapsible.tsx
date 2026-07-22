"use client";

import { useState } from "react";

interface Props {
  defaultOpen: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
  weekId: string;
  zipHref: string;
}

export function PlanWeekCollapsible({ defaultOpen, header, children, weekId, zipHref }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={`week-${weekId}`}>
      <div className="flex items-center border-b border-[var(--border)]">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left px-5 py-4"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            {header}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 text-[var(--text-faint)] transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
        <a
          href={zipHref}
          download
          title="Exportar semana para Garmin"
          className="flex items-center gap-1 px-3 py-1.5 mr-3 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all text-xs shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round"/>
          </svg>
          ZIP
        </a>
      </div>
      {open && children}
    </div>
  );
}
