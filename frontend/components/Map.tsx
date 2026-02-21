'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { useGeocoderStore } from '@/store/useGeocoderStore';
import { useRouting } from '@/hooks/useRouting';
import { getGoogleMapsUrl, getStreetViewUrl, getMidpoint } from '@/lib/google-maps';
import { Plus, Minus, Satellite, Mountain, Map as MapIcon, Layers, Compass } from 'lucide-react';
import AddressSearchBar from './AddressSearchBar';
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

export default function Map() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sourceAddedRef = useRef(false);
  const styleSheetInjectedRef = useRef(false);

  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('terrain');

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

  // Add custom sources and layers to the map
  const addCustomLayers = useCallback((map: mapboxgl.Map) => {
    if (map.getSource('curvature')) return; // Already added

    map.addSource('curvature', {
      type: 'vector',
      tiles: [buildTileUrl(useAppStore.getState().selectedSource)],
      minzoom: 4,
      maxzoom: 14,
    });

    map.addLayer({
      id: 'curvature-layer',
      type: 'line',
      source: 'curvature',
      'source-layer': 'curvature',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'interpolate', ['linear'], ['get', 'curvature'],
          300, '#4CAF50', 600, '#8BC34A', 1000, '#FFEB3B',
          1500, '#FF9800', 2000, '#F44336', 3000, '#9C27B0', 5000, '#4A148C',
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, ['interpolate', ['linear'], ['get', 'curvature'], 300, 0.5, 2000, 1, 5000, 1.5],
          8, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1, 2000, 2, 5000, 3],
          12, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1.5, 2000, 3, 5000, 4.5],
        ],
        'line-opacity': 0.8,
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
        addWaypoint(midLng, midLat, props.name || undefined);
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

    map.setFilter('curvature-layer', ['>=', ['get', 'curvature'], searchFilters.min_curvature]);
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
        <button className="w-9 h-9 bg-bg-card border border-border-subtle rounded flex items-center justify-center text-text-primary hover:text-accent-gold transition">
          <Layers className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 bg-bg-card border border-border-subtle rounded flex items-center justify-center text-text-primary hover:text-accent-gold transition">
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
