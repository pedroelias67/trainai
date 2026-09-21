// Fitting a GPS route into a box, for the shareable image.
//
// The route is drawn as a silhouette, not a map: no streets, no labels, nothing
// to locate it by beyond its own shape. It is the same trimmed track the public
// page shows, so the setting that hides the ends covers the image too.

import type { TrackPoint } from "@/lib/share-privacy";

export type Box = { width: number; height: number; padding: number };
export type Point = { x: number; y: number };

/**
 * Projects latitude and longitude on to canvas coordinates, centred and scaled
 * to fill the box while keeping the route's proportions.
 *
 * Longitude degrees shrink towards the poles, so they are scaled by the cosine
 * of the latitude; without that, a route in Portugal comes out stretched about
 * a quarter wider than it really is.
 */
export function projectTrack(track: TrackPoint[], box: Box): Point[] {
  if (track.length < 2) return [];

  const lats = track.map(p => p.lat);
  const lngs = track.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);

  const usableW = box.width - box.padding * 2;
  const usableH = box.height - box.padding * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  // Centre whatever is left over on the axis the route does not fill.
  const offsetX = box.padding + (usableW - spanX * scale) / 2;
  const offsetY = box.padding + (usableH - spanY * scale) / 2;

  return track.map(p => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    // Canvas y grows downwards; latitude grows north.
    y: offsetY + (maxLat - p.lat) * scale,
  }));
}
