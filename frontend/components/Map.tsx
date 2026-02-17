'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { useCurvyRouteStore } from '@/store/useCurvyRouteStore';
import { useRouting } from '@/hooks/useRouting';
import { getGoogleMapsUrl, getStreetViewUrl, getMidpoint } from '@/lib/google-maps';
import 'mapbox-gl/dist/mapbox-gl.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function buildTileUrl(source: string | null): string {
  const base = `${API_BASE_URL}/curvature/tiles/{z}/{x}/{y}.pbf`;
  if (source) {
    return `${base}?source=${encodeURIComponent(source)}`;
  }
  return base;
}

export default function Map() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sourceAddedRef = useRef(false);

  const mapboxToken = useAppStore((state) => state.mapboxToken);
  const selectedSource = useAppStore((state) => state.selectedSource);
  const searchFilters = useAppStore((state) => state.searchFilters);
  const searchResults = useChatStore((state) => state.searchResults);

  // Waypoint routing state
  const waypointRouteWaypoints = useWaypointRouteStore((state) => state.waypoints);
  const waypointCalculatedRoute = useWaypointRouteStore((state) => state.calculatedRoute);
  const waypointMarkersRef = useRef(new globalThis.Map<string, mapboxgl.Marker>());
  const { recalculateRoute, previewRoute, cancelPreview } = useRouting();

  // Curvy route state
  const curvyStartPoint = useCurvyRouteStore((state) => state.startPoint);
  const curvyEndPoint = useCurvyRouteStore((state) => state.endPoint);
  const curvyResult = useCurvyRouteStore((state) => state.result);
  const curvyStartMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const curvyEndMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-98.5, 39.8],
      zoom: 5,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add the vector tile source
      map.addSource('curvature', {
        type: 'vector',
        tiles: [buildTileUrl(null)],
        minzoom: 4,
        maxzoom: 14,
      });

      // Add the curvature line layer
      map.addLayer({
        id: 'curvature-layer',
        type: 'line',
        source: 'curvature',
        'source-layer': 'curvature',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'curvature'],
            300,  '#4CAF50',   // Green — mild curves
            600,  '#8BC34A',   // Light green
            1000, '#FFEB3B',   // Yellow — moderate
            1500, '#FF9800',   // Orange
            2000, '#F44336',   // Red — very curvy
            3000, '#9C27B0',   // Purple
            5000, '#4A148C',   // Deep purple — extreme
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, ['interpolate', ['linear'], ['get', 'curvature'], 300, 0.5, 2000, 1, 5000, 1.5],
            8, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1, 2000, 2, 5000, 3],
            12, ['interpolate', ['linear'], ['get', 'curvature'], 300, 1.5, 2000, 3, 5000, 4.5],
          ],
          'line-opacity': 0.8,
        },
      });

      // Waypoint routing sources and layers
      map.addSource('waypoint-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // OSRM calculated route line (emerald, dashed)
      map.addLayer({
        id: 'waypoint-route-line',
        type: 'line',
        source: 'waypoint-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#059669',
          'line-width': 4,
          'line-opacity': 0.8,
          'line-dasharray': [2, 1],
        },
      });

      // Curvy route source and layer
      map.addSource('curvy-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'curvy-route-line',
        type: 'line',
        source: 'curvy-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#D97706',
          'line-width': 5,
          'line-opacity': 0.85,
          'line-dasharray': [3, 1.5],
        },
      });

      sourceAddedRef.current = true;

      // General map click handler for curvy route picking mode
      map.on('click', (e: mapboxgl.MapMouseEvent) => {
        const { pickingMode, setStartPoint, setEndPoint } = useCurvyRouteStore.getState();
        if (pickingMode === 'start') {
          setStartPoint(e.lngLat.lng, e.lngLat.lat);
        } else if (pickingMode === 'end') {
          setEndPoint(e.lngLat.lng, e.lngLat.lat);
        }
      });

      // Click handler for curvature segments — adds waypoint or shows popup
      map.on('click', 'curvature-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        // If in curvy route picking mode, don't add waypoints
        const { pickingMode } = useCurvyRouteStore.getState();
        if (pickingMode) return;

        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        // Add a single waypoint at the segment midpoint
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
        toast.success(
          `Added waypoint for "${props.name || 'Unnamed Road'}"`,
          { icon: '\uD83D\uDCCD' }
        );

        // Popup with segment info
        const lengthMi = props.length ? (props.length / 1609).toFixed(2) : '?';
        const surface = props.paved ? 'paved' : 'unpaved';

        // Compute midpoint for Google Maps links
        let popupLat = e.lngLat.lat;
        let popupLon = e.lngLat.lng;
        if (feature.geometry.type === 'LineString') {
          const coords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
          if (coords.length > 0) {
            [popupLat, popupLon] = getMidpoint(coords);
          }
        }
        const mapsUrl = getGoogleMapsUrl(popupLat, popupLon);
        const streetViewUrl = getStreetViewUrl(popupLat, popupLon);

        // Determine badge color based on curvature value
        const curv = props.curvature || 0;
        let badgeColor = '#4CAF50';
        if (curv >= 3000) badgeColor = '#9C27B0';
        else if (curv >= 2000) badgeColor = '#F44336';
        else if (curv >= 1500) badgeColor = '#FF9800';
        else if (curv >= 1000) badgeColor = '#FFEB3B';
        else if (curv >= 600) badgeColor = '#8BC34A';
        const badgeTextColor = (curv >= 1000 && curv < 1500) ? '#333' : '#fff';

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>${props.name || 'Unnamed Road'}</strong><br/>
              Curvature: <span style="display: inline-block; background: ${badgeColor}; color: ${badgeTextColor}; padding: 1px 8px; border-radius: 10px; font-weight: bold; font-size: 12px;">${curv.toLocaleString()}</span><br/>
              Length: ${lengthMi} mi<br/>
              Surface: ${surface}<br/>
              <div style="margin-top: 8px; display: flex; gap: 6px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
                   style="font-size: 12px; color: #4285F4; text-decoration: none; padding: 2px 6px; border: 1px solid #4285F4; border-radius: 4px;">
                  Google Maps
                </a>
                <a href="${streetViewUrl}" target="_blank" rel="noopener noreferrer"
                   style="font-size: 12px; color: #34A853; text-decoration: none; padding: 2px 6px; border: 1px solid #34A853; border-radius: 4px;">
                  Street View
                </a>
              </div>
            </div>
          `)
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
  }, [mapboxToken]);

  // Update tile URL when selected source changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const source = map.getSource('curvature') as mapboxgl.VectorTileSource | undefined;
    if (source) {
      const newUrl = buildTileUrl(selectedSource);
      source.setTiles([newUrl]);
    }
  }, [selectedSource]);

  // Update layer filter when min_curvature changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    map.setFilter('curvature-layer', [
      '>=',
      ['get', 'curvature'],
      searchFilters.min_curvature,
    ]);
  }, [searchFilters.min_curvature]);

  // Handle chat search results - highlight on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    // Remove existing chat results layer and source
    if (map.getLayer('chat-results-layer')) {
      map.removeLayer('chat-results-layer');
    }
    if (map.getSource('chat-results')) {
      map.removeSource('chat-results');
    }

    // If no results, we're done
    if (!searchResults || searchResults.features.length === 0) return;

    // Add source for chat results
    map.addSource('chat-results', {
      type: 'geojson',
      data: searchResults,
    });

    // Add layer for chat results (highlighted in red/cyan)
    map.addLayer({
      id: 'chat-results-layer',
      type: 'line',
      source: 'chat-results',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#00FFFF', // Cyan for visibility
        'line-width': 6,
        'line-opacity': 0.9,
      },
    });

    // Calculate bounds and fit map
    const bounds = new mapboxgl.LngLatBounds();
    searchResults.features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 100,
        maxZoom: 12,
        duration: 1000,
      });
    }

    // Add click handler for chat results
    map.on('click', 'chat-results-layer', (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const props = feature.properties;
      if (!props) return;

      // Compute midpoint for Google Maps links
      let chatLat = e.lngLat.lat;
      let chatLon = e.lngLat.lng;
      if (feature.geometry.type === 'LineString') {
        const coords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
        if (coords.length > 0) {
          [chatLat, chatLon] = getMidpoint(coords);
        }
      }
      const chatMapsUrl = getGoogleMapsUrl(chatLat, chatLon);
      const chatStreetViewUrl = getStreetViewUrl(chatLat, chatLon);

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 8px;">
            <strong style="color: #00BFBF;">${props.name || 'Unnamed Road'}</strong><br/>
            <span style="font-size: 12px; color: #666;">Chat Search Result</span><br/><br/>
            Curvature: <strong>${props.curvature?.toLocaleString()}</strong><br/>
            Length: ${props.length_mi?.toFixed(1) || '?'} mi<br/>
            Surface: ${props.surface || (props.paved ? 'paved' : 'unpaved')}
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <a href="${chatMapsUrl}" target="_blank" rel="noopener noreferrer"
                 style="font-size: 12px; color: #4285F4; text-decoration: none; padding: 2px 6px; border: 1px solid #4285F4; border-radius: 4px;">
                Google Maps
              </a>
              <a href="${chatStreetViewUrl}" target="_blank" rel="noopener noreferrer"
                 style="font-size: 12px; color: #34A853; text-decoration: none; padding: 2px 6px; border: 1px solid #34A853; border-radius: 4px;">
                Street View
              </a>
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'chat-results-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'chat-results-layer', () => {
      map.getCanvas().style.cursor = '';
    });

  }, [searchResults]);

  // Update waypoint route line when calculated route changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const routeSource = map.getSource('waypoint-route') as mapboxgl.GeoJSONSource | undefined;
    if (!routeSource) return;

    if (waypointCalculatedRoute) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: waypointCalculatedRoute.geometry,
            properties: {},
          },
        ],
      });
    } else {
      routeSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [waypointCalculatedRoute]);

  // Manage waypoint markers (draggable Mapbox markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const existingIds = new Set(waypointRouteWaypoints.map((wp) => wp.id));

    // Remove markers that no longer exist
    waypointMarkersRef.current.forEach((marker, id) => {
      if (!existingIds.has(id)) {
        marker.remove();
        waypointMarkersRef.current.delete(id);
      }
    });

    // Add/update markers
    waypointRouteWaypoints.forEach((waypoint, index) => {
      let marker = waypointMarkersRef.current.get(waypoint.id);

      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:24px;height:24px;border-radius:50%;background:#059669;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:grab;';
        el.textContent = String(index + 1);

        marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat([waypoint.lng, waypoint.lat])
          .addTo(map);

        const wpId = waypoint.id;

        marker.on('drag', () => {
          const lngLat = marker!.getLngLat();
          // Build preview waypoints with this one moved
          const previewWps = useWaypointRouteStore.getState().waypoints.map((wp) =>
            wp.id === wpId ? { ...wp, lng: lngLat.lng, lat: lngLat.lat } : wp
          );
          previewRoute(previewWps);
        });

        marker.on('dragend', () => {
          cancelPreview();
          const lngLat = marker!.getLngLat();
          useWaypointRouteStore.getState().updateWaypoint(wpId, lngLat.lng, lngLat.lat);
          // Recalculate will fire via the waypoints effect below
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

  // Update curvy route visualization when result changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const source = map.getSource('curvy-route') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (curvyResult) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: curvyResult.geometry,
            properties: {},
          },
        ],
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [curvyResult]);

  // Manage curvy route start/end markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Start marker
    if (curvyStartPoint) {
      if (!curvyStartMarkerRef.current) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:20px;height:20px;border-radius:50%;background:#16A34A;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);';
        curvyStartMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([curvyStartPoint.lng, curvyStartPoint.lat])
          .addTo(map);
      } else {
        curvyStartMarkerRef.current.setLngLat([curvyStartPoint.lng, curvyStartPoint.lat]);
      }
    } else {
      curvyStartMarkerRef.current?.remove();
      curvyStartMarkerRef.current = null;
    }

    // End marker
    if (curvyEndPoint) {
      if (!curvyEndMarkerRef.current) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:20px;height:20px;border-radius:50%;background:#DC2626;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);';
        curvyEndMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([curvyEndPoint.lng, curvyEndPoint.lat])
          .addTo(map);
      } else {
        curvyEndMarkerRef.current.setLngLat([curvyEndPoint.lng, curvyEndPoint.lat]);
      }
    } else {
      curvyEndMarkerRef.current?.remove();
      curvyEndMarkerRef.current = null;
    }
  }, [curvyStartPoint, curvyEndPoint]);

  // Cleanup curvy route markers on unmount
  useEffect(() => {
    return () => {
      curvyStartMarkerRef.current?.remove();
      curvyEndMarkerRef.current?.remove();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
