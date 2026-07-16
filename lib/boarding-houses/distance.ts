// Client-side distance helpers for the student's "distance from my reference pin"
// search feature on the public boarding-houses page.

export type LatLngPoint = { lat: number; lng: number };

// Great-circle distance in meters between two points.
export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Approximate walking time at a relaxed ~4.5 km/h (75 m/min). Always >= 1 min.
export function approxWalkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 75));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
