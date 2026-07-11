import { prisma } from "@/lib/prisma";
import { Prisma, Sport } from "@prisma/client";
import {
  getStravaActivity,
  getStravaActivityStreams,
  getStravaActivityZones,
  mapStravaSportToSport,
  formatPaceFromSpeed,
  decodePolyline,
} from "@/lib/strava";

export async function syncStravaActivity(
  stravaActivityId: string,
  athleteId: string,
  accessToken: string
) {
  const detailed = await getStravaActivity(Number(stravaActivityId), accessToken);
  const streams = await getStravaActivityStreams(Number(stravaActivityId), accessToken);
  const zonesData = await getStravaActivityZones(Number(stravaActivityId), accessToken);

  // GPS track
  let gpsTrack: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (detailed.map?.summary_polyline) {
    gpsTrack = decodePolyline(detailed.map.summary_polyline) as unknown as Prisma.InputJsonValue;
  } else if (streams.latlng?.data) {
    gpsTrack = (streams.latlng.data as unknown as [number, number][]).map((point, i) => ({
      lat: point[0], lng: point[1],
      ele: streams.altitude?.data?.[i],
      hr: streams.heartrate?.data?.[i],
    })) as unknown as Prisma.InputJsonValue;
  }

  // Splits
  const splits: Prisma.InputJsonValue | typeof Prisma.JsonNull = detailed.splits_metric
    ? (detailed.splits_metric.map((s) => ({
        km: s.split,
        pace: formatPaceFromSpeed(s.average_speed),
        hr: s.average_heartrate ? Math.round(s.average_heartrate) : null,
      })) as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  // HR zones from Strava zones endpoint (time in seconds per zone)
  let hrZones: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  const bucketSource = zonesData && ((zonesData as any).distribution_buckets ?? (zonesData as any).heart_rate?.distribution_buckets);
  if (bucketSource) {
    hrZones = {
      z1: bucketSource[0]?.time ?? 0,
      z2: bucketSource[1]?.time ?? 0,
      z3: bucketSource[2]?.time ?? 0,
      z4: bucketSource[3]?.time ?? 0,
      z5: bucketSource[4]?.time ?? 0,
    };
  }

  // Average cadence from streams if not in activity summary
  const avgCadence = (detailed as any).average_cadence
    ?? (streams.cadence?.data?.length
      ? streams.cadence.data.reduce((a: number, b: number) => a + b, 0) / streams.cadence.data.length
      : null);

  const sport = mapStravaSportToSport(detailed.sport_type ?? detailed.type) as Sport;

  const activity = await prisma.activity.upsert({
    where: { garminActivityId: stravaActivityId },
    create: {
      athleteId,
      garminActivityId: stravaActivityId,
      sport,
      date: new Date(detailed.start_date),
      name: detailed.name,
      distance: detailed.distance,
      duration: detailed.moving_time,
      elevationGain: detailed.total_elevation_gain,
      avgHR: detailed.average_heartrate ? Math.round(detailed.average_heartrate) : null,
      maxHR: detailed.max_heartrate ? Math.round(detailed.max_heartrate) : null,
      avgPace: formatPaceFromSpeed(detailed.average_speed),
      avgPower: detailed.average_watts ?? null,
      avgCadence: avgCadence ? Math.round(avgCadence) : null,
      calories: detailed.calories ?? null,
      trainingLoad: detailed.suffer_score ?? null,
      perceivedExertion: (detailed as any).perceived_exertion ?? null,
      hrZones,
      gpsTrack,
      splits,
      rawData: detailed as unknown as Prisma.InputJsonValue,
    },
    update: {
      name: detailed.name,
      distance: detailed.distance,
      duration: detailed.moving_time,
      avgHR: detailed.average_heartrate ? Math.round(detailed.average_heartrate) : null,
      maxHR: detailed.max_heartrate ? Math.round(detailed.max_heartrate) : null,
      avgPace: formatPaceFromSpeed(detailed.average_speed),
      avgCadence: avgCadence ? Math.round(avgCadence) : null,
      calories: detailed.calories ?? null,
      perceivedExertion: (detailed as any).perceived_exertion ?? null,
      hrZones,
      gpsTrack,
      splits,
    },
  });

  // Match to training session
  const activityDate = new Date(detailed.start_date);
  const dayStart = new Date(activityDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(activityDate); dayEnd.setHours(23, 59, 59, 999);

  const matchingSession = await prisma.trainingSession.findFirst({
    where: {
      week: { plan: { athleteId, status: "ACTIVE" } },
      date: { gte: dayStart, lte: dayEnd },
      sport,
      completed: false,
    },
  });

  if (matchingSession) {
    await prisma.trainingSession.update({
      where: { id: matchingSession.id },
      data: { completed: true, activityId: activity.id },
    });
  }

  return activity;
}
