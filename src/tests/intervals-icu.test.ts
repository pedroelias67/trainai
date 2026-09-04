import { describe, it, expect } from "vitest";
import {
  buildWorkoutDescription,
  buildCalendarEvent,
  formatDuration,
  normalisePace,
  sanitiseSteps,
  renderSteps,
  paceMidSeconds,
  inferThresholdPace,
  zoneToPaceTarget,
  retargetToPace,
  type PlannedSession,
} from "@/lib/intervals-icu";

const base: PlannedSession = {
  id: "abc123",
  name: "Intervalos VO2max",
  sport: "RUNNING",
  sessionType: "INTERVALS",
  date: new Date("2026-09-02T00:00:00Z"),
  plannedDuration: 55,
  plannedPace: null,
  warmup: "15min progressivo Z2.",
  mainSet: "5x3min Z5 com 2min de recuperação.",
  cooldown: "10min trote leve.",
};

describe("formatDuration", () => {
  it("uses the shapes Intervals.icu parses", () => {
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(330)).toBe("5m30s");
    expect(formatDuration(45)).toBe("45s");
  });
});

describe("normalisePace", () => {
  it("passes through a well-formed pace", () => {
    expect(normalisePace("5:02/km")).toBe("5:02/km");
    expect(normalisePace("7:30 / mi")).toBe("7:30/mi");
  });

  it("finds a pace inside a longer phrase", () => {
    // Plans write "5:02/km nas repetições"; requiring the exact string threw
    // the target away and the session fell back to heart-rate zones.
    expect(normalisePace("5:02/km nas repetições")).toBe("5:02/km");
  });

  it("keeps a band as a range, slowest first", () => {
    expect(normalisePace("4:58-5:05/km")).toBe("5:05-4:58/km");
    expect(normalisePace("5:00-5:05/km, Z4 baixo")).toBe("5:05-5:00/km");
  });

  it("rejects anything it cannot trust as a target", () => {
    expect(normalisePace("confortável")).toBeNull();
    expect(normalisePace("Z4")).toBeNull();
    expect(normalisePace(null)).toBeNull();
  });
});

describe("buildWorkoutDescription", () => {
  it("emits a repeat block for an interval session", () => {
    expect(buildWorkoutDescription(base)).toBe(
      [
        "Warmup",
        "- 15m Z1 HR",
        "",
        "5x",
        "- 3m Z5 HR",
        "- 2m Z1 HR",
        "",
        "Cooldown",
        "- 10m Z1 HR",
      ].join("\n")
    );
  });

  it("targets an absolute pace when the session has one", () => {
    const out = buildWorkoutDescription({ ...base, plannedPace: "5:02/km" });
    expect(out).toContain("- 3m 5:02/km Pace");
    expect(out).not.toContain("Z5 HR");
  });

  it("keeps pace targets off non-running sessions", () => {
    const out = buildWorkoutDescription({
      ...base, sport: "CYCLING", plannedPace: "5:02/km",
    });
    expect(out).toContain("Z5 HR");
    expect(out).not.toContain("5:02/km");
  });

  it("omits the recovery step when the set states none", () => {
    const out = buildWorkoutDescription({ ...base, mainSet: "4x8min no limiar." });
    expect(out).toContain("4x\n- 8m Z5 HR\n");
    expect(out.match(/^- /gm)).toHaveLength(3); // warmup, work, cooldown
  });

  it("builds a continuous block when there are no reps", () => {
    const out = buildWorkoutDescription({
      ...base,
      sessionType: "EASY",
      plannedDuration: 40,
      warmup: null,
      mainSet: "40min contínuos Z2.",
      cooldown: null,
    });
    expect(out).toBe(
      ["Warmup", "- 6m Z1 HR", "", "- 30m Z2 HR", "", "Cooldown", "- 4m Z1 HR"].join("\n")
    );
  });

  it("keeps a recovery run as one easy block", () => {
    expect(buildWorkoutDescription({
      ...base, sessionType: "RECOVERY", plannedDuration: 30,
      warmup: null, mainSet: "30min muito leve.", cooldown: null,
    })).toBe("- 30m Z1 HR");
  });

  it("never emits a zero-length step", () => {
    const out = buildWorkoutDescription({
      ...base, sessionType: "EASY", plannedDuration: 5,
      warmup: null, mainSet: "5min.", cooldown: null,
    });
    expect(out).not.toMatch(/- 0[ms]/);
  });
});

describe("sanitiseSteps", () => {
  it("keeps a well-formed workout, including distance steps and repeats", () => {
    const out = sanitiseSteps([
      { name: "Aquecimento", steps: [{ duration: "10m", target: "Z1 HR" }] },
      { repeat: 4, steps: [{ duration: "80mtr", target: "4:30/km Pace" }, { duration: "45s", target: "Z1 HR" }] },
      { repeat: 2, steps: [{ duration: "10m", target: "5:05-4:58/km Pace" }, { duration: "3m", target: "Z1 HR" }] },
    ]);
    expect(out).toHaveLength(3);
    expect(out![1]).toMatchObject({ repeat: 4 });
    expect(out![2].steps[0].target).toBe("5:05-4:58/km Pace");
  });

  it("drops what Intervals.icu would not parse", () => {
    // These would otherwise be sent verbatim to someone's watch.
    const out = sanitiseSteps([
      { steps: [
        { duration: "10 minutos", target: "Z1 HR" },   // unit spelled out
        { duration: "4x80mtr", target: "Z2 HR" },      // a repeat smuggled into a duration
        { duration: "10m", target: "ritmo forte" },    // target not machine-readable
        { duration: "10m", target: "Z9 HR" },          // zone out of range
      ] },
    ]);
    expect(out).toHaveLength(1);
    // The two with a valid duration survive. Their unreadable targets fall back
    // to Z1 rather than being left blank: a step with no target gives the athlete
    // nothing on the watch, and appears to stop Intervals.icu reading further.
    expect(out![0].steps).toEqual([
      { duration: "10m", target: "Z1 HR" },
      { duration: "10m", target: "Z1 HR" },
    ]);
  });

  it("gives every step a target, including those that arrive without one", () => {
    const out = sanitiseSteps([{ steps: [{ duration: "2m" }, { duration: "30s" }] }]);
    expect(out![0].steps.every(s => s.target)).toBe(true);
  });

  it("ignores a repeat that is absent, one, or absurd", () => {
    expect(sanitiseSteps([{ repeat: 1, steps: [{ duration: "5m" }] }])![0].repeat).toBeUndefined();
    expect(sanitiseSteps([{ repeat: 99, steps: [{ duration: "5m" }] }])![0].repeat).toBeUndefined();
  });

  it("returns null when nothing survives", () => {
    expect(sanitiseSteps([{ steps: [{ duration: "uma hora" }] }])).toBeNull();
    expect(sanitiseSteps("não é um array")).toBeNull();
    expect(sanitiseSteps(null)).toBeNull();
  });
});

describe("renderSteps", () => {
  it("writes the line format Intervals.icu reads", () => {
    expect(renderSteps([
      { name: "Aquecimento", steps: [{ duration: "10m", target: "Z1 HR" }] },
      { repeat: 4, steps: [{ duration: "80mtr", target: "4:30/km Pace" }, { duration: "45s", target: "Z1 HR" }] },
      { name: "Arrefecimento", steps: [{ duration: "8m" }] },
    ])).toBe(
      [
        "Aquecimento",
        "- 10m Z1 HR",
        "",
        "4x",
        "- 80mtr 4:30/km Pace",
        "- 45s Z1 HR",
        "",
        "Arrefecimento",
        "- 8m",
      ].join("\n")
    );
  });
});

describe("buildWorkoutDescription with declared steps", () => {
  it("uses the structure rather than parsing the prose", () => {
    // The strides here exist only in the structure: the prose route flattens a
    // warmup to a single block and loses them.
    const out = buildWorkoutDescription({
      ...base,
      steps: [
        { name: "Aquecimento", steps: [{ duration: "10m", target: "Z1 HR" }] },
        { repeat: 4, steps: [{ duration: "80mtr", target: "4:30/km Pace" }] },
        { repeat: 2, steps: [{ duration: "10m", target: "5:02/km Pace" }, { duration: "3m", target: "Z1 HR" }] },
      ],
    });
    expect(out).toContain("4x\n- 80mtr 4:30/km Pace");
    expect(out).toContain("2x\n- 10m 5:02/km Pace");
  });

  it("falls back to the prose when the structure is unusable", () => {
    const out = buildWorkoutDescription({ ...base, steps: [{ steps: [{ duration: "meia hora" }] }] });
    expect(out).toContain("5x"); // from parsing base.mainSet
  });
});

describe("paceMidSeconds", () => {
  it("reads a single pace and the middle of a range", () => {
    expect(paceMidSeconds("5:00/km")).toBe(300);
    expect(paceMidSeconds("5:10-4:50/km")).toBe(300);
    expect(paceMidSeconds("5:02/km nas repetições")).toBe(302);
  });

  it("converts a mile pace to the kilometre it stands for", () => {
    expect(Math.round(paceMidSeconds("8:03/mi")!)).toBe(300);
  });

  it("has nothing to read in prose", () => {
    expect(paceMidSeconds("confortável")).toBeNull();
    expect(paceMidSeconds(null)).toBeNull();
  });
});

describe("inferThresholdPace", () => {
  const session = (sessionType: string, plannedPace: string | null) =>
    ({ sport: "RUNNING", sessionType, plannedPace });

  it("takes the athlete's own threshold when they have stated one", () => {
    expect(inferThresholdPace("5:30/km", [session("EASY", "6:00/km")])).toBe(330);
  });

  it("reads it back out of the plan when they have not", () => {
    // A tempo session run at 5:02 is Z4, which sits at 1.015x threshold.
    const t = inferThresholdPace(null, [
      session("TEMPO", "5:02/km"),
      session("EASY", "6:20/km"),
      session("RECOVERY", "7:15/km"),
    ]);
    expect(Math.round(t!)).toBe(308);
  });

  it("ignores what it cannot place: other sports, paceless sessions, nonsense", () => {
    expect(inferThresholdPace(null, [
      { sport: "CYCLING", sessionType: "TEMPO", plannedPace: "5:00/km" },
      session("EASY", null),
      session("EASY", "0:30/km"), // implies a 24s/km threshold
    ])).toBeNull();
  });

  it("falls back to the plan when the stated threshold is not a pace", () => {
    expect(Math.round(inferThresholdPace("rápido", [session("TEMPO", "5:02/km")])!)).toBe(298);
  });
});

describe("zoneToPaceTarget", () => {
  it("expands a zone into the band it stands for", () => {
    expect(zoneToPaceTarget("Z2 HR", 300)).toBe("6:36-5:45/km Pace");
    expect(zoneToPaceTarget("Z5 HR", 300)).toBe("4:57-4:30/km Pace");
  });

  it("leaves a target that is already a pace alone", () => {
    expect(zoneToPaceTarget("5:02/km Pace", 300)).toBe("5:02/km Pace");
  });
});

describe("retargetToPace", () => {
  it("converts every heart-rate step, keeping structure and paces intact", () => {
    expect(retargetToPace([
      { name: "Aquecimento", steps: [{ duration: "10m", target: "Z1 HR" }] },
      { repeat: 2, steps: [
        { duration: "10m", target: "5:02/km Pace" },
        { duration: "5m", target: "Z1 HR" },
      ] },
    ], 300)).toEqual([
      { name: "Aquecimento", steps: [{ duration: "10m", target: "7:30-6:15/km Pace" }] },
      { repeat: 2, steps: [
        { duration: "10m", target: "5:02/km Pace" },
        { duration: "5m", target: "7:30-6:15/km Pace" },
      ] },
    ]);
  });
});

describe("buildWorkoutDescription with a pace reference", () => {
  // The session the athlete ran on 2 September: twelve steps, two of which
  // carried a pace. The watch guided by heart rate for the other ten and only
  // reported the pace once each was over.
  const tempo: PlannedSession = {
    ...base,
    sessionType: "TEMPO",
    steps: [
      { name: "Aquecimento", steps: [{ duration: "7m", target: "Z2 HR" }] },
      { repeat: 2, steps: [
        { duration: "10m", target: "5:02/km Pace" },
        { duration: "5m", target: "Z1 HR" },
      ] },
      { name: "Arrefecimento", steps: [{ duration: "10m", target: "Z1 HR" }] },
    ],
  };

  it("leaves no step guiding by heart rate", () => {
    const out = buildWorkoutDescription(tempo, 308);
    expect(out).not.toContain("HR");
    expect(out.match(/^- .*Pace$/gm)).toHaveLength(4);
  });

  it("keeps heart rate when there is no reference to convert against", () => {
    expect(buildWorkoutDescription(tempo)).toContain("Z2 HR");
  });

  it("keeps heart rate off running's units for other sports", () => {
    // 5:00/km on a bike is a number about nothing.
    expect(buildWorkoutDescription({ ...tempo, sport: "CYCLING" }, 308)).toContain("Z2 HR");
  });

  it("converts the prose fallback too, warmup and cooldown included", () => {
    const out = buildWorkoutDescription({ ...base, steps: undefined }, 300);
    expect(out).not.toContain("HR");
    expect(out).toContain("- 15m 7:30-6:15/km Pace"); // warmup, was Z1 HR
  });

  it("refuses a reference pace that cannot be right", () => {
    expect(buildWorkoutDescription(tempo, 12)).toContain("Z2 HR");
  });
});

describe("buildCalendarEvent", () => {
  it("maps the session on to the event fields", () => {
    const event = buildCalendarEvent(base);
    expect(event).toMatchObject({
      category: "WORKOUT",
      type: "Run",
      name: "Intervalos VO2max",
      start_date_local: "2026-09-02T00:00:00",
      external_id: "trainai-abc123",
    });
  });

  it("maps sports to Intervals.icu activity types", () => {
    expect(buildCalendarEvent({ ...base, sport: "CYCLING" }).type).toBe("Ride");
    expect(buildCalendarEvent({ ...base, sport: "SWIMMING" }).type).toBe("Swim");
  });

  it("keys the event on the session so re-pushing updates rather than duplicates", () => {
    expect(buildCalendarEvent(base).external_id).toBe(buildCalendarEvent({ ...base, name: "Outro nome" }).external_id);
  });
});
