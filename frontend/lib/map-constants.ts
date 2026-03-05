/**
 * Shared map configuration constants.
 */

export const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/dark-v11',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

/** Curvature color scale: value thresholds mapped to colors */
export const CURVATURE_COLORS = {
  relaxed: { threshold: 0, color: '#29B6F6' },     // < 600: Sky Blue
  spirited: { threshold: 600, color: '#26C97E' },   // Emerald
  engaging: { threshold: 1000, color: '#FFC107' },   // Amber
  technical: { threshold: 2000, color: '#FF6D2A' },  // Deep Orange
  expert: { threshold: 5000, color: '#E53935' },     // Crimson
  legendary: { threshold: 10000, color: '#9C27B0' }, // Electric Purple
} as const;

/** Mapbox style expression for curvature line colors */
export const CURVATURE_COLOR_EXPRESSION = [
  'step', ['get', 'curvature'],
  CURVATURE_COLORS.relaxed.color,
  CURVATURE_COLORS.spirited.threshold, CURVATURE_COLORS.spirited.color,
  CURVATURE_COLORS.engaging.threshold, CURVATURE_COLORS.engaging.color,
  CURVATURE_COLORS.technical.threshold, CURVATURE_COLORS.technical.color,
  CURVATURE_COLORS.expert.threshold, CURVATURE_COLORS.expert.color,
  CURVATURE_COLORS.legendary.threshold, CURVATURE_COLORS.legendary.color,
] as const;

/** Minimum zoom level before fetching EV stations */
export const EV_FETCH_MIN_ZOOM = 8;

/** Debounce delay (ms) for EV station fetches on map move */
export const EV_DEBOUNCE_MS = 500;

/** Shared popup CSS injected once into the document */
export const POPUP_CSS = `
  .mapboxgl-popup-content {
    background: #1A1A1A !important;
    border: 1px solid #2A2A2A !important;
    border-radius: 6px !important;
    padding: 0 !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    color: #F5F4F2 !important;
  }
  .mapboxgl-popup-tip {
    border-top-color: #1A1A1A !important;
  }
  .mapboxgl-popup-close-button {
    color: #5A5A5A !important;
    font-size: 18px !important;
    padding: 4px 8px !important;
  }
  .mapboxgl-popup-close-button:hover {
    color: #F5F4F2 !important;
    background: transparent !important;
  }
  .mapboxgl-popup-content {
    overflow-wrap: break-word !important;
    word-break: break-word !important;
  }
`;
