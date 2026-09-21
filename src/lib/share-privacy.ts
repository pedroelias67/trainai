// Hiding where a shared run started and finished.
//
// A public map of a morning run is, nine times out of ten, a map with the
// athlete's front door at both ends of it. Trimming a radius from each end keeps
// the shape of the run and drops the part that says where they live.

export type TrackPoint = { lat: number; lng: number; ele?: number; hr?: number; pace?: number };

/** Roughly two streets: enough to cover a doorway without gutting a short run. */
export const PRIVACY_RADIUS_M = 300;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceBetween(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * The track without its first and last `radius` metres, measured as a straight
 * line from each end point rather than along the path — so an out-and-back that
 * passes the door mid-run has that pass hidden too.
 *
 * Returns an empty track when trimming would leave too little to be worth
 * showing: a short loop around the block is all doorstep, and half a map is
 * worse than none.
 */
export function trimTrackEnds(
  track: TrackPoint[],
  radius = PRIVACY_RADIUS_M
): TrackPoint[] {
  if (track.length < 4) return [];

  const start = track[0];
  const end = track[track.length - 1];
  const kept = track.filter(
    p => distanceBetween(p, start) > radius && distanceBetween(p, end) > radius
  );

  // Fewer than a quarter of the points left means the run barely leaves the
  // hidden circles, and what remains would still point at them.
  return kept.length >= Math.max(4, track.length * 0.25) ? kept : [];
}
