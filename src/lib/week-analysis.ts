// Reading back the coach's analysis of a week.
//
// The field held two different shapes: one route wrote the whole analysis as
// JSON, another wrote only the summary as plain text. The plan page parsed it as
// JSON without a guard, so a week written by the second route would have taken
// the page down with it. That route is gone; this reads either shape, because
// the rows it wrote may still be out there.

export type WeekAnalysis = {
  summary: string;
  adaptations?: string;
  nextWeekAdjustments?: string;
};

export function parseWeekAnalysis(raw: string | null): WeekAnalysis | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.summary === "string") {
      return {
        summary: parsed.summary,
        ...(typeof parsed.adaptations === "string" ? { adaptations: parsed.adaptations } : {}),
        ...(typeof parsed.nextWeekAdjustments === "string"
          ? { nextWeekAdjustments: parsed.nextWeekAdjustments }
          : {}),
      };
    }
  } catch {
    // Not JSON: it is the summary itself.
  }

  return { summary: raw };
}
