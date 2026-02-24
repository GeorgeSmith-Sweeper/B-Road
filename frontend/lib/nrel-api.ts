const NREL_API_URL = 'https://developer.nrel.gov/api/alt-fuel-stations/v1.json';
const API_KEY = process.env.NEXT_PUBLIC_NREL_API_KEY || 'DEMO_KEY';
const MAX_RADIUS = 100; // miles
const LIMIT = 200;

export interface EVStation {
  id: number;
  station_name: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  ev_network: string | null;
  ev_connector_types: string[] | null;
  ev_level2_evse_num: number | null;
  ev_dc_fast_num: number | null;
  access_days_time: string | null;
  latitude: number;
  longitude: number;
}

export async function fetchEVStations(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<GeoJSON.FeatureCollection> {
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;

  // Estimate radius from bounds (rough miles)
  const latDiff = Math.abs(bounds.north - bounds.south);
  const lngDiff = Math.abs(bounds.east - bounds.west);
  const radiusMiles = Math.min(
    Math.max(latDiff, lngDiff) * 69 / 2,
    MAX_RADIUS,
  );

  const params = new URLSearchParams({
    api_key: API_KEY,
    fuel_type: 'ELEC',
    status: 'E',
    latitude: centerLat.toString(),
    longitude: centerLng.toString(),
    radius: radiusMiles.toFixed(1),
    limit: LIMIT.toString(),
  });

  const res = await fetch(`${NREL_API_URL}?${params}`);
  if (!res.ok) throw new Error(`NREL API error: ${res.status}`);

  const data = await res.json();
  const stations: EVStation[] = data.fuel_stations || [];

  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
      properties: {
        id: s.id,
        name: s.station_name,
        address: s.street_address,
        city: s.city,
        state: s.state,
        network: s.ev_network,
        connectorTypes: s.ev_connector_types,
        level2Count: s.ev_level2_evse_num,
        dcFastCount: s.ev_dc_fast_num,
        hours: s.access_days_time,
      },
    })),
  };
}
