"use client";

import { useState } from "react";

interface Props {
  defaultOpen: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
  weekId: string;
}

export function PlanWeekCollapsible({ defaultOpen, header, children, weekId }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={`week-${weekId}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          {header}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-[var(--text-faint)] transition-transform shrink-0 ml-2 ${open ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
      {open && children}
    </div>
  );
}
