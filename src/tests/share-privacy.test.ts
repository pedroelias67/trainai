import { describe, it, expect } from "vitest";
import { distanceBetween, PRIVACY_RADIUS_M, trimTrackEnds, type TrackPoint } from "@/lib/share-privacy";

/** A straight line of points heading north from a start, `stepM` apart. */
function line(count: number, stepM = 100, from: TrackPoint = { lat: 41.15, lng: -8.61 }): TrackPoint[] {
  const degPerM = 1 / 111_320;
  return Array.from({ length: count }, (_, i) => ({ lat: from.lat + i * stepM * degPerM, lng: from.lng }));
}

describe("distanceBetween", () => {
  it("measures metres on the ground", () => {
    const [a, b] = line(2, 100);
    expect(Math.round(distanceBetween(a, b))).toBeGreaterThan(95);
    expect(Math.round(distanceBetween(a, b))).toBeLessThan(105);
  });
});

describe("trimTrackEnds", () => {
  it("drops the points near both ends and keeps the middle", () => {
    const track = line(100); // ~10 km out
    const trimmed = trimTrackEnds(track);

    expect(trimmed.length).toBeGreaterThan(80);
    expect(distanceBetween(trimmed[0], track[0])).toBeGreaterThan(PRIVACY_RADIUS_M);
    expect(distanceBetween(trimmed[trimmed.length - 1], track[track.length - 1])).toBeGreaterThan(PRIVACY_RADIUS_M);
  });

  it("hides a mid-run pass by the door as well", () => {
    // Out and back: the turnaround is at the far end, so the middle of the array
    // is the far point and both halves come home. Trimming by distance from the
    // ends, not by position, covers a loop that touches home again.
    const out = line(60);
    const back = [...out].reverse();
    const trimmed = trimTrackEnds([...out, ...back]);

    expect(trimmed.every(p => distanceBetween(p, out[0]) > PRIVACY_RADIUS_M)).toBe(true);
  });

  it("shows nothing rather than a map that still points home", () => {
    // A lap of the block: every point is within the hidden radius.
    expect(trimTrackEnds(line(20, 20))).toEqual([]);
    // And a track too short to say anything about.
    expect(trimTrackEnds(line(3))).toEqual([]);
  });

  it("keeps whatever the points carry", () => {
    const track = line(100).map((p, i) => ({ ...p, ele: 10 + i, pace: 300 }));
    expect(trimTrackEnds(track)[0]).toMatchObject({ pace: 300 });
  });
});
