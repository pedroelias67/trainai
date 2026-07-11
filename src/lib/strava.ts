// Strava API v3 integration

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_AUTH = "https://www.strava.com/oauth";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number; firstname: string; lastname: string };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number;           // metros
  moving_time: number;        // segundos
  elapsed_time: number;       // segundos
  total_elevation_gain: number;
  average_speed: number;      // m/s
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  calories?: number;
  suffer_score?: number;      // training load proxy
  map?: { summary_polyline: string };
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    moving_time: number;
    average_speed: number;
    average_heartrate?: number;
    split: number;
  }>;
  laps?: Array<{
    average_speed: number;
    average_heartrate?: number;
    elapsed_time: number;
    distance: number;
  }>;
}

export interface StravaDetailedActivity extends StravaActivity {
  streams?: Record<string, any>;
}

export function getStravaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.STRAVA_CALLBACK_URL!,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });
  return `${STRAVA_AUTH}/authorize?${params}`;
}

export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const res = await fetch(`${STRAVA_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token error: ${res.status}`);
  return res.json();
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(`${STRAVA_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava refresh error: ${res.status}`);
  return res.json();
}

export async function getStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}?include_all_efforts=false`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava activity error: ${res.status}`);
  return res.json();
}

export async function getStravaActivityStreams(
  activityId: number,
  accessToken: string
): Promise<Record<string, { data: number[] }>> {
  const keys = "latlng,altitude,heartrate,velocity_smooth,time,cadence,watts";
  const res = await fetch(
    `${STRAVA_API}/activities/${activityId}/streams?keys=${keys}&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return {};
  return res.json();
}

export async function getStravaActivityZones(
  activityId: number,
  accessToken: string
): Promise<{ heart_rate?: { distribution_buckets: Array<{ min: number; max: number; time: number }> } } | null> {
  const res = await fetch(
    `${STRAVA_API}/activities/${activityId}/zones`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const zones = await res.json();
  return Array.isArray(zones) ? zones.find((z: any) => z.type === "heartrate") ?? null : null;
}

export async function getRecentStravaActivities(
  accessToken: string,
  afterTimestamp: number
): Promise<StravaActivity[]> {
  const res = await fetch(
    `${STRAVA_API}/athlete/activities?after=${afterTimestamp}&per_page=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava activities error: ${res.status}`);
  return res.json();
}

export function mapStravaSportToSport(stravaType: string): string {
  const map: Record<string, string> = {
    Run: "RUNNING", TrailRun: "RUNNING", VirtualRun: "RUNNING",
    Ride: "CYCLING", VirtualRide: "CYCLING", MountainBikeRide: "CYCLING",
    Swim: "SWIMMING", OpenWaterSwim: "SWIMMING",
  };
  return map[stravaType] ?? "RUNNING";
}

export function formatPaceFromSpeed(speedMs: number): string {
  if (!speedMs || speedMs === 0) return "—";
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}

// Descodificar polyline do Google/Strava para array de coordenadas
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
