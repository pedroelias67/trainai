// Garmin Health API integration
// Documentação: https://developer.garmin.com/health-api/overview/

const GARMIN_BASE_URL = "https://apis.garmin.com";
const GARMIN_AUTH_URL = "https://connectapi.garmin.com/oauth-service/oauth";

export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: { typeKey: string };
  startTimeGMT: string;
  distance: number;        // metros
  duration: number;        // segundos
  elevationGain: number;
  averageHR: number;
  maxHR: number;
  averageSpeed: number;    // m/s
  calories: number;
  trainingEffect: number;
  anaerobicTrainingEffect: number;
  aerobicTrainingEffect: number;
}

export interface GarminTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// OAuth 1.0a para Garmin Connect API
export function getGarminAuthUrl(callbackUrl: string): string {
  const params = new URLSearchParams({
    oauth_callback: callbackUrl,
    oauth_consumer_key: process.env.GARMIN_CLIENT_ID!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  });

  return `${GARMIN_AUTH_URL}/authorize?${params.toString()}`;
}

export async function getGarminActivities(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<GarminActivity[]> {
  const params = new URLSearchParams({
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  });

  const response = await fetch(
    `${GARMIN_BASE_URL}/wellness-api/rest/activityDetails?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Garmin API error: ${response.status}`);
  }

  return response.json();
}

export function mapGarminSportToSport(garminType: string): string {
  const mapping: Record<string, string> = {
    running: "RUNNING",
    cycling: "CYCLING",
    swimming: "SWIMMING",
    open_water_swimming: "SWIMMING",
    triathlon: "TRIATHLON_OLYMPIC",
    indoor_cycling: "CYCLING",
    trail_running: "RUNNING",
  };

  return mapping[garminType.toLowerCase()] ?? "RUNNING";
}

export function formatPaceFromSpeed(speedMs: number): string {
  if (!speedMs || speedMs === 0) return "N/A";
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}
