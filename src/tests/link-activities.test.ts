import { describe, it, expect } from "vitest";
import { matchSessionsToActivities } from "@/lib/link-activities";

const at = (day: number, hour = 8) => new Date(2026, 8, day, hour);

describe("matchSessionsToActivities", () => {
  it("ticks off the session for a day already trained", () => {
    // The case that prompted this: a plan generated after the morning run asked
    // for that run again.
    const pairs = matchSessionsToActivities(
      [{ id: "s-hoje", date: at(21), sport: "RUNNING" }],
      [{ id: "a-hoje", date: at(21, 7), sport: "RUNNING" }]
    );
    expect(pairs).toEqual([{ sessionId: "s-hoje", activityId: "a-hoje" }]);
  });

  it("does not pair across days or across sports", () => {
    expect(matchSessionsToActivities(
      [{ id: "s1", date: at(21), sport: "RUNNING" }],
      [{ id: "a1", date: at(20), sport: "RUNNING" }]
    )).toEqual([]);

    expect(matchSessionsToActivities(
      [{ id: "s1", date: at(21), sport: "RUNNING" }],
      [{ id: "a1", date: at(21), sport: "CYCLING" }]
    )).toEqual([]);
  });

  it("uses each activity once", () => {
    // Two sessions on one day and a single run: the second stays open.
    const pairs = matchSessionsToActivities(
      [
        { id: "s1", date: at(21, 6), sport: "RUNNING" },
        { id: "s2", date: at(21, 18), sport: "RUNNING" },
      ],
      [{ id: "a1", date: at(21, 7), sport: "RUNNING" }]
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sessionId).toBe("s1");
  });

  it("leaves an extra run unclaimed rather than inventing a session for it", () => {
    const pairs = matchSessionsToActivities(
      [{ id: "s1", date: at(21), sport: "RUNNING" }],
      [
        { id: "a1", date: at(21, 7), sport: "RUNNING" },
        { id: "a2", date: at(21, 19), sport: "RUNNING" },
      ]
    );
    expect(pairs).toEqual([{ sessionId: "s1", activityId: "a1" }]);
  });

  it("works through a week in order", () => {
    const pairs = matchSessionsToActivities(
      [
        { id: "qua", date: at(23), sport: "RUNNING" },
        { id: "seg", date: at(21), sport: "RUNNING" },
        { id: "dom", date: at(27), sport: "RUNNING" },
      ],
      [
        { id: "a21", date: at(21), sport: "RUNNING" },
        { id: "a23", date: at(23), sport: "RUNNING" },
      ]
    );
    expect(pairs.map(p => p.sessionId)).toEqual(["seg", "qua"]);
  });
});
