import { describe, it, expect } from "vitest";
import { parseWeekAnalysis } from "@/lib/week-analysis";

describe("parseWeekAnalysis", () => {
  it("reads the analysis written as JSON", () => {
    const raw = JSON.stringify({ summary: "Boa semana", adaptations: "Mantém", nextWeekAdjustments: "Sobe 10%" });
    expect(parseWeekAnalysis(raw)).toEqual({
      summary: "Boa semana", adaptations: "Mantém", nextWeekAdjustments: "Sobe 10%",
    });
  });

  it("reads one written as plain text", () => {
    // A second route used to write just the summary; the plan page parsed the
    // field as JSON without a guard and would have thrown on this.
    expect(parseWeekAnalysis("Correu bem, apesar do vento.")).toEqual({ summary: "Correu bem, apesar do vento." });
  });

  it("treats JSON that is not an analysis as text", () => {
    expect(parseWeekAnalysis('["a","b"]')).toEqual({ summary: '["a","b"]' });
    expect(parseWeekAnalysis('{"outra":"coisa"}')).toEqual({ summary: '{"outra":"coisa"}' });
  });

  it("has nothing to show for an empty field", () => {
    expect(parseWeekAnalysis(null)).toBeNull();
    expect(parseWeekAnalysis("   ")).toBeNull();
  });
});
