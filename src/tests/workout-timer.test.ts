import { describe, it, expect } from "vitest";
import { parseIntervals, buildPhases } from "@/lib/workout-phases";

// The coach's mainSet is free text written by the AI, so the parser is checked
// against the shapes it actually produces — including the ones it must ignore.
describe("parseIntervals", () => {
  it("reads reps and recovery from the usual phrasing", () => {
    expect(parseIntervals("5x3min a ritmo VO2max (Z5) com 2min de recuperação ativa."))
      .toEqual({ reps: 5, workSecs: 180, restSecs: 120 });
  });

  it("copes with spaces and spelled-out units", () => {
    expect(parseIntervals("6 x 4 minutos Z5, recuperação de 90s a trote leve."))
      .toEqual({ reps: 6, workSecs: 240, restSecs: 90 });
  });

  it("reads recovery past the accents in 'recuperação'", () => {
    expect(parseIntervals("8x2min Z5, recuperação de 60s.")?.restSecs).toBe(60);
  });

  it("accepts the prime symbol for minutes", () => {
    expect(parseIntervals("10x1' forte com 1min recuperação."))
      .toEqual({ reps: 10, workSecs: 60, restSecs: 60 });
  });

  it("takes the second duration of a paired set as the recovery", () => {
    expect(parseIntervals("4x(3min Z5 + 2min Z1)"))
      .toEqual({ reps: 4, workSecs: 180, restSecs: 120 });
  });

  it("handles 'descanso' as well as 'recuperação'", () => {
    expect(parseIntervals("8x2min Z5, descanso de 60s.")?.restSecs).toBe(60);
  });

  it("leaves recovery null when none is stated", () => {
    expect(parseIntervals("3x10min no limiar.")).toEqual({ reps: 3, workSecs: 600, restSecs: null });
  });

  // Anything it cannot time must fall back rather than guess.
  it("ignores continuous sessions", () => {
    expect(parseIntervals("35min corrida contínua Z2. Pace: 6:30-7:00/km ou FC 130-140bpm.")).toBeNull();
  });

  it("ignores distance-based sets, which cannot be timed without a pace", () => {
    expect(parseIntervals("6x800m a ritmo de 5K com 400m de recuperação.")).toBeNull();
  });

  it("never reads a pace as a repetition", () => {
    expect(parseIntervals("60min contínuos Z2 a 6:30/km.")).toBeNull();
  });

  it("rejects implausible rep counts and durations", () => {
    expect(parseIntervals("1x5min")).toBeNull();
    expect(parseIntervals("40x2min")).toBeNull();
    expect(parseIntervals("3x45min")).toBeNull();
  });

  it("returns null without a main set", () => {
    expect(parseIntervals(null)).toBeNull();
  });

  // Taken from a session that reached a watch as one 27-minute block because
  // none of these phrasings were recognised.
  describe("phrasings the coach actually writes", () => {
    it("reads a set spelled out in words", () => {
      expect(parseIntervals(
        "2 repetições de 10min ao ritmo objetivo da corrida (4:58-5:05/km). " +
        "FC alvo: 140-155 bpm (Z4). Recuperação entre repetições: 3min corrida Z1"
      )).toEqual({ reps: 2, workSecs: 600, restSecs: 180 });
    });

    it("accepts séries and blocos as well as x", () => {
      expect(parseIntervals("4 séries de 6min no limiar, com 2min de recuperação."))
        .toEqual({ reps: 4, workSecs: 360, restSecs: 120 });
      expect(parseIntervals("3 blocos de 8min a ritmo de prova, 2min de trote entre eles."))
        .toEqual({ reps: 3, workSecs: 480, restSecs: 120 });
    });

    it("finds a recovery separated from its keyword by other words", () => {
      // The digit in "Z1" used to cut the search short.
      expect(parseIntervals(
        "2x8 minutos ao ritmo de prova — 5:00-5:05/km. 3 minutos de corrida Z1 de recuperação."
      )?.restSecs).toBe(180);
    });

    it("does not mistake the work interval for the recovery", () => {
      expect(parseIntervals("4x5min a 4:30/km. Sem indicação de pausa.")?.restSecs).toBeNull();
    });

    it("does not read a pace as a duration", () => {
      expect(parseIntervals("3x10min a 5:05/km, recuperação de 90s.")?.restSecs).toBe(90);
    });
  });
});

describe("buildPhases", () => {
  const noText = { warmup: null, mainSet: null, cooldown: null };

  it("reads plannedDuration as minutes, not seconds", () => {
    const phases = buildPhases("EASY", 40, noText);
    expect(phases.reduce((sum, p) => sum + p.duration, 0)).toBe(40 * 60);
    expect(phases[0].duration).toBe(6 * 60);
  });

  it("expands an interval set into one phase per rep", () => {
    const phases = buildPhases("INTERVALS", 55, {
      warmup: "15min progressivo Z2.",
      mainSet: "5x3min Z5 com 2min de recuperação.",
      cooldown: "10min trote leve.",
    });
    // warmup + 5 reps + 4 recoveries + cooldown
    expect(phases).toHaveLength(11);
    expect(phases[0]).toMatchObject({ label: "Aquecimento", duration: 15 * 60 });
    expect(phases[1]).toMatchObject({ label: "Série 1/5", duration: 180 });
    expect(phases[2]).toMatchObject({ label: "Recuperação", duration: 120 });
    expect(phases.at(-1)).toMatchObject({ label: "Arrefecimento", duration: 10 * 60 });
  });

  it("does not trail a recovery after the last rep", () => {
    const phases = buildPhases("INTERVALS", 50, {
      warmup: null, mainSet: "4x2min com 1min recuperação.", cooldown: null,
    });
    expect(phases.at(-2)?.label).toBe("Série 4/4");
  });

  it("falls back to coarse phases when the set cannot be timed", () => {
    const phases = buildPhases("INTERVALS", 50, {
      warmup: null, mainSet: "6x800m a ritmo de 5K com 400m recuperação.", cooldown: null,
    });
    expect(phases.map(p => p.label)).toEqual(["Aquecimento", "Intervalos", "Arrefecimento"]);
  });

  it("keeps the strength main block positive on short sessions", () => {
    expect(buildPhases("STRENGTH", 10, noText).every(p => p.duration > 0)).toBe(true);
  });
});

describe("phase hints", () => {
  const text = {
    warmup: "10min Z1 + 4x30s acelerações.",
    mainSet: "5x3min Z5 com 2min de recuperação.",
    cooldown: "10min trote muito leve.",
  };

  it("gives each phase the step it belongs to", () => {
    const phases = buildPhases("INTERVALS", 55, text);
    expect(phases[0].hint).toBe(text.warmup);
    expect(phases[1].hint).toBe(text.mainSet);
    expect(phases[2].hint).toMatch(/Trote muito leve/);
    expect(phases.at(-1)?.hint).toBe(text.cooldown);
  });

  it("hints the coarse phases too", () => {
    const phases = buildPhases("EASY", 40, text);
    expect(phases.map(p => p.hint)).toEqual([text.warmup, text.mainSet, text.cooldown]);
  });

  it("leaves the hint empty when the session has no description", () => {
    expect(buildPhases("LONG", 90, { warmup: null, mainSet: null, cooldown: null })
      .every(p => !p.hint)).toBe(true);
  });
});
