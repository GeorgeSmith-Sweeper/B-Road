/**
 * Google Maps URL helpers.
 * Uses standard URL schemes that open directly in the browser — no API key needed.
 */

/** Returns a Google Maps URL centered on the given lat/lon. */
export function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/** Returns a Google Street View URL at the given lat/lon. */
export function getStreetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

/** Returns a Google Maps directions URL with multiple waypoints. */
export function getDirectionsUrl(waypoints: [number, number][]): string {
  const stops = waypoints.map(([lat, lon]) => `${lat},${lon}`).join('/');
  return `https://www.google.com/maps/dir/${stops}`;
}

/**
 * Computes the midpoint of a GeoJSON coordinate array.
 * GeoJSON uses [lon, lat] order; this returns [lat, lon] for Google URLs.
 */
export function getMidpoint(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) return [0, 0];
  const midIdx = Math.floor(coordinates.length / 2);
  const [lon, lat] = coordinates[midIdx];
  return [lat, lon];
}
