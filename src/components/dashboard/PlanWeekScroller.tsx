"use client";

import { useEffect } from "react";

export function PlanWeekScroller({ currentWeekId }: { currentWeekId: string }) {
  useEffect(() => {
    const el = document.getElementById(`week-${currentWeekId}`);
    if (el) {
      // Small delay so the page has finished painting
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [currentWeekId]);

  return null;
}
