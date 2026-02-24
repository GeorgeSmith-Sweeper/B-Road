'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { useGeocoderStore } from '@/store/useGeocoderStore';
import { useLayerStore } from '@/store/useLayerStore';
import { useRouting } from '@/hooks/useRouting';
import { getGoogleMapsUrl, getStreetViewUrl, getMidpoint } from '@/lib/google-maps';
import { fetchEVStations } from '@/lib/nrel-api';
import { Plus, Minus, Satellite, Mountain, Map as MapIcon, Layers, Compass } from 'lucide-react';
import AddressSearchBar from './AddressSearchBar';
import LayerMenu from './LayerMenu';
import 'mapbox-gl/dist/mapbox-gl.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/dark-v11',
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

function buildTileUrl(source: string | null): string {
  const base = `${API_BASE_URL}/curvature/tiles/{z}/{x}/{y}.pbf`;
  if (source) {
    return `${base}?source=${encodeURIComponent(source)}`;
  }
  return base;
}

// Shared popup CSS injected once
const POPUP_CSS = `
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
`;

function buildSegmentPopupHTML(
  name: string,
  curv: number,
  lengthMi: string,
  surface: string,
  mapsUrl: string,
  streetViewUrl: string,
) {
  return `
    <div style="padding: 10px 14px; font-family: 'Cormorant Garamond', serif;">
      <div style="font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; color: #F5F4F2; margin-bottom: 2px;">
        ${name}
      </div>
      <div style="font-size: 12px; font-style: italic; color: #8A8A8A; margin-bottom: 8px;">
        ${lengthMi} mi  &middot;  ${surface}  &middot;  Curvature ${curv.toLocaleString()}
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1px; color: #0D0D0D; background: #C9A962; padding: 4px 8px; border-radius: 3px; text-decoration: none;">
          MAPS
        </a>
        <a href="${streetViewUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1px; color: #8A8A8A; padding: 4px 8px; border-radius: 3px; text-decoration: none; border: 1px solid #2A2A2A;">
          STREET VIEW
        </a>
      </div>
    </div>
  `;
}

function buildChatResultPopupHTML(
  name: string,
  curvature: string,
  lengthMi: string,
  surface: string,
  mapsUrl: string,
  streetViewUrl: string,
) {
  return `
    <div style="padding: 10px 14px; font-family: 'Cormorant Garamond', serif;">
      <div style="font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; color: #F5F4F2; margin-bottom: 2px;">
        ${name}
      </div>
      <div style="font-size: 12px; font-style: italic; color: #8A8A8A; margin-bottom: 8px;">
        ${lengthMi} mi  &middot;  ${surface}  &middot;  Curvature ${curvature}
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1px; color: #0D0D0D; background: #C9A962; padding: 4px 8px; border-radius: 3px; text-decoration: none;">
          MAPS
        </a>
        <a href="${streetViewUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1px; color: #8A8A8A; padding: 4px 8px; border-radius: 3px; text-decoration: none; border: 1px solid #2A2A2A;">
          STREET VIEW
        </a>
      </div>
    </div>
  `;
}

function buildGeocoderPopupHTML(name: string, address: string) {
  return `
    <div style="padding: 10px 14px; font-family: 'Cormorant Garamond', serif; min-width: 180px;">
      <div style="font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; color: #F5F4F2; margin-bottom: 2px;">
        ${name}
      </div>
      <div style="font-size: 12px; font-style: italic; color: #8A8A8A; margin-bottom: 10px;">
        ${address}
      </div>
      <button id="geocoder-add-waypoint"
        style="display: inline-flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1px; color: #0D0D0D; background: #C9A962; padding: 6px 12px; border-radius: 3px; border: none; cursor: pointer;">
        ADD AS WAYPOINT
      </button>
    </div>
  `;
}

function buildGasStationPopupHTML(name: string) {
  return `
    <div style="padding: 10px 14px; font-family: 'Cormorant Garamond', serif; min-width: 160px;">
      <div style="font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; color: #F5F4F2; margin-bottom: 2px;">
        ${name}
      </div>
      <div style="font-size: 11px; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; color: #34D399;">
        GAS STATION
      </div>
    </div>
  `;
}

function buildEVStationPopupHTML(props: Record<string, unknown>) {
  const name = String(props.name || 'EV Station');
  const network = props.network ? String(props.network) : null;
  const address = props.address ? String(props.address) : null;
  const city = props.city ? String(props.city) : null;
  const state = props.state ? String(props.state) : null;
  const l2 = props.level2Count != null ? Number(props.level2Count) : null;
  const dcFast = props.dcFastCount != null ? Number(props.dcFastCount) : null;
  const hours = props.hours ? String(props.hours) : null;

  const locationLine = [address, [city, state].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const plugParts: string[] = [];
  if (l2 != null && l2 > 0) plugParts.push(`L2: ${l2}`);
  if (dcFast != null && dcFast > 0) plugParts.push(`DC Fast: ${dcFast}`);

  return `
    <div style="padding: 10px 14px; font-family: 'Cormorant Garamond', serif; min-width: 200px; max-width: 280px;">
      <div style="font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; color: #F5F4F2; margin-bottom: 2px;">
        ${name.toUpperCase()}
      </div>
      <div style="font-size: 11px; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; color: #60A5FA; margin-bottom: 6px;">
        EV CHARGING${network ? ` &middot; ${network.toUpperCase()}` : ''}
      </div>
      ${locationLine ? `<div style="font-size: 12px; font-style: italic; color: #8A8A8A; margin-bottom: 4px;">${locationLine}</div>` : ''}
      ${plugParts.length > 0 ? `<div style="font-size: 12px; color: #8A8A8A; margin-bottom: 4px;">${plugParts.join(' &middot; ')}</div>` : ''}
      ${hours ? `<div style="font-size: 11px; color: #5A5A5A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hours}</div>` : ''}
    </div>
  `;
}

const EV_FETCH_MIN_ZOOM = 8;
const EV_DEBOUNCE_MS = 500;

export default function Map() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sourceAddedRef = useRef(false);
  const styleSheetInjectedRef = useRef(false);

  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('terrain');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const layerButtonRef = useRef<HTMLButtonElement>(null);
  const evDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapboxToken = useAppStore((state) => state.mapboxToken);
  const selectedSource = useAppStore((state) => state.selectedSource);
  const searchFilters = useAppStore((state) => state.searchFilters);
  const searchResults = useChatStore((state) => state.searchResults);

  // Waypoint routing state
  const waypointRouteWaypoints = useWaypointRouteStore((state) => state.waypoints);
  const waypointCalculatedRoute = useWaypointRouteStore((state) => state.calculatedRoute);
  const waypointMarkersRef = useRef(new globalThis.Map<string, mapboxgl.Marker>());
  const { recalculateRoute, previewRoute, cancelPreview } = useRouting();

  // Geocoder state
  const geocoderSelectedResult = useGeocoderStore((state) => state.selectedResult);
  const geocoderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const geocoderPopupRef = useRef<mapboxgl.Popup | null>(null);

  // Layer visibility state
  const gasStationsVisible = useLayerStore((s) => s.gasStationsVisible);
  const evChargingVisible = useLayerStore((s) => s.evChargingVisible);

  // Add custom sources and layers to the map
  const addCustomLayers = useCallback((map: mapboxgl.Map) => {
    if (map.getSource('curvature')) return; // Already added

    map.addSource('curvature', {
      type: 'vector',
      tiles: [buildTileUrl(useAppStore.getState().selectedSource)],
      minzoom: 4,
      maxzoom: 14,
    });

    // Halo layer: white outline behind colored roads for legibility
    map.addLayer({
      id: 'curvature-halo',
      type: 'line',
      source: 'curvature',
      'source-layer': 'curvature',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.6)',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, ['interpolate', ['linear'], ['get', 'curvature'], 300, 2.5, 2000, 3, 5000, 3.5],
          8, ['interpolate', ['linear'], ['get', 'curvature'], 300, 3, 2000, 4, 5000, 5],
          12, ['interpolate', ['linear'], ['get', 'curvature'], 300, 3.5, 2000, 5, 5000, 6.5],
        ],
        'line-opacity': 0.5,
      },
      filter: ['>=', ['get', 'curvature'], useAppStore.getState().searchFilters.min_curvature],
    });

    map.addLayer({
      id: 'curvature-layer',
      type: 'line',
      source: 'curvature',
      'source-layer': 'curvature',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'step', ['get', 'curvature'],
          '#29B6F6',   // < 600: Relaxed (Sky Blue)
          600, '#26C97E',   // Spirited (Emerald)
          1000, '#FFC107',  // Engaging (Amber)
          2000, '#FF6D2A',  // Technical (Deep Orange)
          5000, '#E53935',  // Expert (Crimson)
          10000, '#9C27B0', // Legendary (Electric Purple)
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, ['interpolate', ['linear'], ['get', 'curvature'], 300, 0.5, 2000, 1, 5000, 1.5],
          8, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1, 2000, 2, 5000, 3],
          12, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1.5, 2000, 3, 5000, 4.5],
        ],
        'line-opacity': 0.9,
      },
      filter: ['>=', ['get', 'curvature'], useAppStore.getState().searchFilters.min_curvature],
    });

    map.addSource('waypoint-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'waypoint-route-line',
      type: 'line',
      source: 'waypoint-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#C9A962', 'line-width': 4, 'line-opacity': 0.9 },
    });

    // Gas station layer (from Mapbox Streets vector tileset)
    map.addSource('gas-stations', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    });

    map.addLayer({
      id: 'gas-stations-layer',
      type: 'circle',
      source: 'gas-stations',
      'source-layer': 'poi_label',
      minzoom: 8,
      filter: ['==', ['get', 'maki'], 'fuel'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7],
        'circle-color': '#34D399',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#064E3B',
        'circle-opacity': 0.85,
      },
    });

    // EV charging layer (GeoJSON source, populated on moveend)
    map.addSource('ev-stations', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'ev-stations-layer',
      type: 'circle',
      source: 'ev-stations',
      minzoom: 8,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7],
        'circle-color': '#60A5FA',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#1E3A5F',
        'circle-opacity': 0.85,
      },
    });

    sourceAddedRef.current = true;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapRef.current) return;

    // Inject popup styles once
    if (!styleSheetInjectedRef.current) {
      const style = document.createElement('style');
      style.textContent = POPUP_CSS;
      document.head.appendChild(style);
      styleSheetInjectedRef.current = true;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.terrain,
      center: [-98.5, 39.8],
      zoom: 5,
    });

    mapRef.current = map;

    map.on('load', () => {
      addCustomLayers(map);

      // Track map center for geocoding proximity bias
      map.on('moveend', () => {
        const center = map.getCenter();
        useAppStore.getState().setMapCenter([center.lng, center.lat]);
      });

      // Click handler for curvature segments
      map.on('click', 'curvature-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const { addWaypoint } = useWaypointRouteStore.getState();
        let midLng = e.lngLat.lng;
        let midLat = e.lngLat.lat;
        if (feature.geometry.type === 'LineString') {
          const coords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
          if (coords.length > 0) {
            const midIdx = Math.floor(coords.length / 2);
            [midLng, midLat] = coords[midIdx];
          }
        }
        addWaypoint(midLng, midLat, props.name || undefined, props.curvature);
        toast.success(`Added waypoint for "${props.name || 'Unnamed Road'}"`, { icon: '\uD83D\uDCCD' });

        const lengthMi = props.length ? (props.length / 1609).toFixed(1) : '?';
        const surface = props.paved ? 'Paved' : 'Unpaved';

        let popupLat = e.lngLat.lat;
        let popupLon = e.lngLat.lng;
        if (feature.geometry.type === 'LineString') {
          const coords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
          if (coords.length > 0) {
            [popupLat, popupLon] = getMidpoint(coords);
          }
        }

        new mapboxgl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(buildSegmentPopupHTML(
            (props.name || 'Unnamed Road').toUpperCase(),
            props.curvature || 0,
            lengthMi,
            surface,
            getGoogleMapsUrl(popupLat, popupLon),
            getStreetViewUrl(popupLat, popupLon),
          ))
          .addTo(map);
      });

      map.on('mouseenter', 'curvature-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'curvature-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Gas station click handler
      map.on('click', 'gas-stations-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const name = props?.name || 'Gas Station';
        new mapboxgl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(buildGasStationPopupHTML(name.toUpperCase()))
          .addTo(map);
      });

      map.on('mouseenter', 'gas-stations-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'gas-stations-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // EV station click handler
      map.on('click', 'ev-stations-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties || {};
        new mapboxgl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(buildEVStationPopupHTML(props))
          .addTo(map);
      });

      map.on('mouseenter', 'ev-stations-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ev-stations-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      sourceAddedRef.current = false;
    };
  }, [mapboxToken, addCustomLayers]);

  // Handle map style changes
  const handleStyleChange = useCallback((style: MapStyleKey) => {
    const map = mapRef.current;
    if (!map) return;

    setActiveStyle(style);
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    // Remove all existing markers temporarily
    waypointMarkersRef.current.forEach((marker) => marker.remove());

    sourceAddedRef.current = false;
    map.setStyle(MAP_STYLES[style]);

    map.once('style.load', () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
      addCustomLayers(map);

      // Restore waypoint route data
      const route = useWaypointRouteStore.getState().calculatedRoute;
      if (route) {
        const routeSource = map.getSource('waypoint-route') as mapboxgl.GeoJSONSource | undefined;
        routeSource?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: route.geometry, properties: {} }],
        });
      }

      // Restore POI layer visibility after style swap
      const { gasStationsVisible: gasVis, evChargingVisible: evVis } = useLayerStore.getState();
      if (gasVis && map.getLayer('gas-stations-layer')) {
        map.setLayoutProperty('gas-stations-layer', 'visibility', 'visible');
      }
      if (evVis && map.getLayer('ev-stations-layer')) {
        map.setLayoutProperty('ev-stations-layer', 'visibility', 'visible');
        // Re-fetch EV data for current viewport
        const bounds = map.getBounds();
        if (!bounds) return;
        fetchEVStations({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }).then((geojson) => {
          const source = map.getSource('ev-stations') as mapboxgl.GeoJSONSource | undefined;
          source?.setData(geojson);
        }).catch((err) => console.error('Failed to fetch EV stations:', err));
      }

      // Re-add markers
      const waypoints = useWaypointRouteStore.getState().waypoints;
      waypoints.forEach((waypoint, index) => {
        const existing = waypointMarkersRef.current.get(waypoint.id);
        if (existing) {
          existing.setLngLat([waypoint.lng, waypoint.lat]).addTo(map);
        }
      });
    });
  }, [addCustomLayers]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  // Update tile URL when selected source changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const source = map.getSource('curvature') as mapboxgl.VectorTileSource | undefined;
    if (source) {
      source.setTiles([buildTileUrl(selectedSource)]);
    }
  }, [selectedSource]);

  // Update layer filter when min_curvature changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const filter: mapboxgl.FilterSpecification = ['>=', ['get', 'curvature'], searchFilters.min_curvature];
    map.setFilter('curvature-layer', filter);
    map.setFilter('curvature-halo', filter);
  }, [searchFilters.min_curvature]);

  // Handle chat search results
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    if (map.getLayer('chat-results-layer')) map.removeLayer('chat-results-layer');
    if (map.getSource('chat-results')) map.removeSource('chat-results');

    if (!searchResults || searchResults.features.length === 0) return;

    map.addSource('chat-results', { type: 'geojson', data: searchResults });

    map.addLayer({
      id: 'chat-results-layer',
      type: 'line',
      source: 'chat-results',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#C9A962', 'line-width': 6, 'line-opacity': 0.9 },
    });

    const bounds = new mapboxgl.LngLatBounds();
    searchResults.features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 100, maxZoom: 12, duration: 1000 });
    }

    map.on('click', 'chat-results-layer', (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const props = feature.properties;
      if (!props) return;

      let chatLat = e.lngLat.lat;
      let chatLon = e.lngLat.lng;
      if (feature.geometry.type === 'LineString') {
        const coords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
        if (coords.length > 0) {
          [chatLat, chatLon] = getMidpoint(coords);
        }
      }

      new mapboxgl.Popup({ offset: 12, closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(buildChatResultPopupHTML(
          (props.name || 'Unnamed Road').toUpperCase(),
          props.curvature?.toLocaleString() || '?',
          props.length_mi?.toFixed(1) || '?',
          props.surface || (props.paved ? 'Paved' : 'Unpaved'),
          getGoogleMapsUrl(chatLat, chatLon),
          getStreetViewUrl(chatLat, chatLon),
        ))
        .addTo(map);
    });

    map.on('mouseenter', 'chat-results-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'chat-results-layer', () => {
      map.getCanvas().style.cursor = '';
    });
  }, [searchResults]);

  // Update waypoint route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const routeSource = map.getSource('waypoint-route') as mapboxgl.GeoJSONSource | undefined;
    if (!routeSource) return;

    if (waypointCalculatedRoute) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: waypointCalculatedRoute.geometry, properties: {} }],
      });
    } else {
      routeSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [waypointCalculatedRoute]);

  // Manage waypoint markers (draggable, gold-themed)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const existingIds = new Set(waypointRouteWaypoints.map((wp) => wp.id));

    waypointMarkersRef.current.forEach((marker, id) => {
      if (!existingIds.has(id)) {
        marker.remove();
        waypointMarkersRef.current.delete(id);
      }
    });

    waypointRouteWaypoints.forEach((waypoint, index) => {
      let marker = waypointMarkersRef.current.get(waypoint.id);

      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:32px;height:32px;border-radius:50%;background:#C9A962;color:#0D0D0D;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;font-family:"Bebas Neue",sans-serif;box-shadow:0 2px 12px rgba(201,169,98,0.4);cursor:grab;';
        el.textContent = String(index + 1);

        marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat([waypoint.lng, waypoint.lat])
          .addTo(map);

        const wpId = waypoint.id;

        marker.on('drag', () => {
          const lngLat = marker!.getLngLat();
          const previewWps = useWaypointRouteStore.getState().waypoints.map((wp) =>
            wp.id === wpId ? { ...wp, lng: lngLat.lng, lat: lngLat.lat } : wp
          );
          previewRoute(previewWps);
        });

        marker.on('dragend', () => {
          cancelPreview();
          const lngLat = marker!.getLngLat();
          useWaypointRouteStore.getState().updateWaypoint(wpId, lngLat.lng, lngLat.lat);
        });

        waypointMarkersRef.current.set(waypoint.id, marker);
      } else {
        marker.setLngLat([waypoint.lng, waypoint.lat]);
        const el = marker.getElement();
        el.textContent = String(index + 1);
      }
    });
  }, [waypointRouteWaypoints, previewRoute, cancelPreview]);

  // Recalculate route when waypoints change
  useEffect(() => {
    recalculateRoute(waypointRouteWaypoints);
  }, [waypointRouteWaypoints, recalculateRoute]);

  // Cleanup waypoint markers on unmount
  useEffect(() => {
    return () => {
      waypointMarkersRef.current.forEach((marker) => marker.remove());
      waypointMarkersRef.current.clear();
    };
  }, []);

  // Handle geocoder result
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    geocoderPopupRef.current?.remove();
    geocoderPopupRef.current = null;
    geocoderMarkerRef.current?.remove();
    geocoderMarkerRef.current = null;

    if (!geocoderSelectedResult) return;

    const [lng, lat] = geocoderSelectedResult.coordinates;

    map.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });

    // Gold-themed geocoder pin
    const el = document.createElement('div');
    el.style.cssText =
      'width:28px;height:28px;border-radius:50% 50% 50% 0;background:#C9A962;border:3px solid #0D0D0D;box-shadow:0 2px 8px rgba(201,169,98,0.4);transform:rotate(-45deg);';

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);

    geocoderMarkerRef.current = marker;

    const popup = new mapboxgl.Popup({ offset: 20, closeButton: true })
      .setLngLat([lng, lat])
      .setHTML(buildGeocoderPopupHTML(
        geocoderSelectedResult.name.toUpperCase(),
        geocoderSelectedResult.full_address,
      ))
      .addTo(map);

    geocoderPopupRef.current = popup;

    document.getElementById('geocoder-add-waypoint')?.addEventListener('click', () => {
      useWaypointRouteStore.getState().addWaypoint(lng, lat, geocoderSelectedResult.name);
      popup.remove();
    });
  }, [geocoderSelectedResult]);

  // Cleanup geocoder marker on unmount
  useEffect(() => {
    return () => {
      geocoderMarkerRef.current?.remove();
      geocoderPopupRef.current?.remove();
    };
  }, []);

  // Toggle gas station layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    if (!map.getLayer('gas-stations-layer')) return;
    map.setLayoutProperty('gas-stations-layer', 'visibility', gasStationsVisible ? 'visible' : 'none');
  }, [gasStationsVisible]);

  // Toggle EV charging layer visibility + fetch data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    if (!map.getLayer('ev-stations-layer')) return;
    map.setLayoutProperty('ev-stations-layer', 'visibility', evChargingVisible ? 'visible' : 'none');

    // Fetch EV stations for current viewport immediately when toggled on
    if (evChargingVisible && map.getZoom() >= EV_FETCH_MIN_ZOOM) {
      const bounds = map.getBounds();
      if (!bounds) return;
      fetchEVStations({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }).then((geojson) => {
        const source = map.getSource('ev-stations') as mapboxgl.GeoJSONSource | undefined;
        source?.setData(geojson);
      }).catch((err) => console.error('Failed to fetch EV stations:', err));
    }
  }, [evChargingVisible]);

  // Fetch EV stations on moveend (debounced)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleMoveEnd() {
      if (!useLayerStore.getState().evChargingVisible) return;
      if (map!.getZoom() < EV_FETCH_MIN_ZOOM) return;

      if (evDebounceRef.current) clearTimeout(evDebounceRef.current);
      evDebounceRef.current = setTimeout(() => {
        const bounds = map!.getBounds();
        if (!bounds) return;
        fetchEVStations({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }).then((geojson) => {
          const source = map!.getSource('ev-stations') as mapboxgl.GeoJSONSource | undefined;
          source?.setData(geojson);
        }).catch((err) => console.error('Failed to fetch EV stations:', err));
      }, EV_DEBOUNCE_MS);
    }

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
      if (evDebounceRef.current) clearTimeout(evDebounceRef.current);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <AddressSearchBar />

      {/* Map Type Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex rounded-md bg-bg-card border border-border-subtle overflow-hidden">
        {([
          { key: 'satellite' as MapStyleKey, icon: Satellite, label: 'SATELLITE' },
          { key: 'terrain' as MapStyleKey, icon: Mountain, label: 'TERRAIN' },
          { key: 'streets' as MapStyleKey, icon: MapIcon, label: 'STREETS' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => handleStyleChange(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 font-bebas text-[11px] tracking-[1px] transition ${
              activeStyle === key
                ? 'bg-bg-muted text-accent-gold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-px">
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 bg-bg-card border border-border-subtle rounded-t flex items-center justify-center text-text-secondary hover:text-text-primary transition"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-bg-card border border-border-subtle rounded-b flex items-center justify-center text-text-secondary hover:text-text-primary transition"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Layer & Compass Controls */}
      <div className="absolute top-[108px] right-4 z-10 flex flex-col gap-2">
        <div className="relative">
          <button
            ref={layerButtonRef}
            onClick={() => setLayerMenuOpen((v) => !v)}
            className={`w-9 h-9 bg-bg-card border border-border-subtle rounded flex items-center justify-center transition ${
              gasStationsVisible || evChargingVisible
                ? 'text-accent-gold'
                : 'text-text-primary hover:text-accent-gold'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
          <LayerMenu open={layerMenuOpen} onClose={() => setLayerMenuOpen(false)} anchorRef={layerButtonRef} />
        </div>
        <button className="w-9 h-9 bg-bg-card border border-border-subtle rounded flex items-center justify-center text-text-primary hover:text-accent-gold transition">
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
