import { createServerFn } from "@tanstack/react-start";

export interface ResponseRoute {
  /** Encoded polyline of the drive path, or null when routing is unavailable. */
  polyline: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  error?: string;
}

interface RouteInput {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

const isLat = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 90;
const isLng = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 180;

export const getResponseRoute = createServerFn({ method: "POST" })
  .inputValidator((input: RouteInput) => {
    if (!isLat(input?.originLat) || !isLat(input?.destLat)) throw new Error("Invalid latitude");
    if (!isLng(input?.originLng) || !isLng(input?.destLng)) throw new Error("Invalid longitude");
    return input;
  })
  .handler(async ({ data }): Promise<ResponseRoute> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) {
      return {
        polyline: null,
        distanceMeters: null,
        durationSeconds: null,
        error: "Routing credentials are not configured",
      };
    }

    const response = await fetch(
      "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: data.originLat, longitude: data.originLng } } },
          destination: { location: { latLng: { latitude: data.destLat, longitude: data.destLng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(`Routes API failed [${response.status}]: ${body}`);
      if (response.status === 403) {
        const reason = (() => {
          try {
            const details: Array<{ reason?: string }> = JSON.parse(body)?.error?.details ?? [];
            return details.find((d) => d.reason)?.reason;
          } catch {
            return undefined;
          }
        })();
        if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
          return {
            polyline: null,
            distanceMeters: null,
            durationSeconds: null,
            error:
              'Google Maps server key is referrer-restricted. Set its application restrictions to "None" or "IP addresses".',
          };
        }
        if (reason === "API_KEY_SERVICE_BLOCKED") {
          return {
            polyline: null,
            distanceMeters: null,
            durationSeconds: null,
            error: "Google Maps server key does not allow the Routes API.",
          };
        }
      }
      return {
        polyline: null,
        distanceMeters: null,
        durationSeconds: null,
        error: `Routing unavailable (${response.status})`,
      };
    }

    const json = (await response.json()) as {
      routes?: Array<{
        polyline?: { encodedPolyline?: string };
        distanceMeters?: number;
        duration?: string;
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      return {
        polyline: null,
        distanceMeters: null,
        durationSeconds: null,
        error: "No drivable route found",
      };
    }
    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters ?? null,
      durationSeconds: route.duration ? Number.parseInt(route.duration, 10) : null,
    };
  });
