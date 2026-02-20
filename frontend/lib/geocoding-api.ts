export interface GeocodingFeature {
  id: string;
  name: string;
  full_address: string;
  coordinates: [number, number]; // [lng, lat]
}

interface MapboxGeocodingFeature {
  id: string;
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface MapboxGeocodingResponse {
  features: MapboxGeocodingFeature[];
}

interface ForwardGeocodeOptions {
  proximity?: [number, number]; // [lng, lat] — bias results near this point
  limit?: number;
  country?: string;
}

export async function forwardGeocode(
  query: string,
  token: string,
  options: ForwardGeocodeOptions = {}
): Promise<GeocodingFeature[]> {
  const { proximity, limit = 5, country } = options;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    limit: String(limit),
  });

  if (proximity) {
    params.set('proximity', `${proximity[0]},${proximity[1]}`);
  }
  if (country) {
    params.set('country', country);
  }

  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params}`
  );

  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status}`);
  }

  const data: MapboxGeocodingResponse = await res.json();

  return data.features.map((f) => ({
    id: f.id,
    name: f.properties.name,
    full_address:
      f.properties.full_address || f.properties.place_formatted || f.properties.name,
    coordinates: f.geometry.coordinates,
  }));
}
