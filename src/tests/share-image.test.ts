import { describe, it, expect } from "vitest";
import { projectTrack } from "@/lib/share-image";
import type { TrackPoint } from "@/lib/share-privacy";

const box = { width: 1000, height: 1000, padding: 100 };

describe("projectTrack", () => {
  it("fits the route inside the padded box", () => {
    const track: TrackPoint[] = [
      { lat: 41.15, lng: -8.61 }, { lat: 41.17, lng: -8.60 },
      { lat: 41.16, lng: -8.58 }, { lat: 41.15, lng: -8.61 },
    ];
    const points = projectTrack(track, box);

    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(box.padding - 0.001);
      expect(p.x).toBeLessThanOrEqual(box.width - box.padding + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(box.padding - 0.001);
      expect(p.y).toBeLessThanOrEqual(box.height - box.padding + 0.001);
    }
  });

  it("puts north at the top", () => {
    const [south, north] = projectTrack(
      [{ lat: 41.15, lng: -8.61 }, { lat: 41.17, lng: -8.61 }],
      box
    );
    expect(north.y).toBeLessThan(south.y);
  });

  it("keeps the shape rather than stretching it to the edges", () => {
    // A square in metres is taller than it is wide in degrees, because a degree
    // of longitude is shorter than one of latitude away from the equator.
    const degLat = 0.01;
    const degLng = degLat / Math.cos((41.15 * Math.PI) / 180);
    const points = projectTrack(
      [
        { lat: 41.15, lng: -8.61 },
        { lat: 41.15 + degLat, lng: -8.61 },
        { lat: 41.15 + degLat, lng: -8.61 + degLng },
        { lat: 41.15, lng: -8.61 + degLng },
      ],
      box
    );
    const width = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
    const height = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
    expect(width / height).toBeCloseTo(1, 1);
  });

  it("centres a route that cannot fill both axes", () => {
    // A north-south line: nothing to spread across the width, so it sits in the
    // middle rather than against the left edge.
    const points = projectTrack(
      [{ lat: 41.15, lng: -8.61 }, { lat: 41.25, lng: -8.61 }],
      box
    );
    expect(points[0].x).toBeCloseTo(box.width / 2, 0);
  });

  it("has nothing to draw for a track with no shape", () => {
    expect(projectTrack([{ lat: 41.15, lng: -8.61 }], box)).toEqual([]);
    expect(projectTrack([], box)).toEqual([]);
  });
});
