'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useRouteStore, RouteSegmentData } from '@/store/useRouteStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
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
  const routeSegments = useRouteStore((state) => state.routeSegments);
  const isBuilding = useRouteStore((state) => state.isBuilding);

  // Waypoint routing state
  const waypointRouteWaypoints = useWaypointRouteStore((state) => state.waypoints);
  const waypointCalculatedRoute = useWaypointRouteStore((state) => state.calculatedRoute);
  const waypointHighlightedIds = useWaypointRouteStore((state) => state.highlightedSegmentIds);
  const waypointMarkersRef = useRef(new globalThis.Map<string, mapboxgl.Marker>());
  const { recalculateRoute, previewRoute, cancelPreview } = useRouting();

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
            'case',
            ['<', ['get', 'curvature'], 600], '#FFC107',
            ['<', ['get', 'curvature'], 1000], '#FF9800',
            ['<', ['get', 'curvature'], 2000], '#F44336',
            '#9C27B0',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 2, 12, 4],
          'line-opacity': 0.8,
        },
      });

      // Add empty route builder sources and layers
      map.addSource('route-builder', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('route-builder-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Route line layer (purple, thick)
      map.addLayer({
        id: 'route-builder-line',
        type: 'line',
        source: 'route-builder',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#8B5CF6',
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });

      // Route numbered markers (circle background)
      map.addLayer({
        id: 'route-builder-markers',
        type: 'circle',
        source: 'route-builder-points',
        paint: {
          'circle-radius': 12,
          'circle-color': '#8B5CF6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Route numbered markers (text label)
      map.addLayer({
        id: 'route-builder-labels',
        type: 'symbol',
        source: 'route-builder-points',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Waypoint routing sources and layers
      map.addSource('waypoint-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('waypoint-highlight', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Highlighted segments (green glow under clicked segments)
      map.addLayer({
        id: 'waypoint-highlight-layer',
        type: 'line',
        source: 'waypoint-highlight',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10B981',
          'line-width': 8,
          'line-opacity': 0.6,
        },
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

      sourceAddedRef.current = true;

      // Click handler for curvature segments — adds to route or shows popup
      map.on('click', 'curvature-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        // Waypoint routing: add waypoints from segment endpoints
        const { addWaypointsFromSegment, waypoints: currentWaypoints, highlightedSegmentIds } =
          useWaypointRouteStore.getState();

        // Check if this segment is already in the waypoint route
        const segId = String(props.id || props.way_id || '');

        if (!highlightedSegmentIds.includes(segId)) {
          // Extract geometry
          let wpCoords: [number, number][] = [];
          if (feature.geometry.type === 'LineString') {
            wpCoords = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
          }
          if (wpCoords.length >= 2) {
            const startCoord = wpCoords[0];
            const endCoord = wpCoords[wpCoords.length - 1];
            addWaypointsFromSegment(
              segId,
              props.name || null,
              startCoord as [number, number],
              endCoord as [number, number],
            );
            toast.success(
              `Added waypoints for "${props.name || 'Unnamed Road'}"`,
              { icon: '\uD83D\uDCCD' }
            );
          }
        } else {
          toast('Segment already in route', { icon: '\u26A0\uFE0F' });
        }

        const { isBuilding, addSegment, routeSegments } = useRouteStore.getState();

        if (isBuilding) {
          // Extract geometry coordinates from the clicked feature
          let coordinates: [number, number][] = [];
          if (feature.geometry.type === 'LineString') {
            coordinates = (feature.geometry as GeoJSON.LineString).coordinates as [number, number][];
          }

          // Use first/last coordinate as start/end (lon,lat from GeoJSON → lat,lon for storage)
          const startCoord = coordinates[0] || [e.lngLat.lng, e.lngLat.lat];
          const endCoord = coordinates[coordinates.length - 1] || [e.lngLat.lng, e.lngLat.lat];

          const segment: RouteSegmentData = {
            way_id: props.id || props.way_id || Date.now(),
            name: props.name || null,
            curvature: props.curvature || 0,
            length: props.length || 0,
            start: [startCoord[1], startCoord[0]], // lat, lon
            end: [endCoord[1], endCoord[0]], // lat, lon
            radius: props.radius || 0,
            curvature_level: props.curvature_level || 0,
            highway: props.highway || null,
            surface: props.surface || null,
            coordinates,
          };

          const added = addSegment(segment);
          if (added) {
            const stopNum = routeSegments.length + 1;
            toast.success(`Added "${props.name || 'Unnamed Road'}" as stop #${stopNum}`);
          } else {
            toast('Already in route', { icon: '\u26A0\uFE0F' });
          }

          // Prevent the popup from showing when building
          e.originalEvent.stopPropagation();
          return;
        }

        // Default popup behavior when not building
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

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>${props.name || 'Unnamed Road'}</strong><br/>
              Curvature: ${props.curvature}<br/>
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

  // Update route visualization when segments change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    // Build GeoJSON for route lines
    const lineFeatures: GeoJSON.Feature[] = routeSegments.map((seg, i) => {
      // Use stored coordinates if available, otherwise build from start/end
      const coords = seg.coordinates.length > 0
        ? seg.coordinates
        : [
            [seg.start[1], seg.start[0]], // lon, lat
            [seg.end[1], seg.end[0]],
          ];

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: coords,
        },
        properties: {
          index: i,
          name: seg.name,
        },
      };
    });

    // Build GeoJSON for numbered markers (at midpoint of each segment)
    const pointFeatures: GeoJSON.Feature[] = routeSegments.map((seg, i) => {
      let lng: number, lat: number;
      if (seg.coordinates.length > 0) {
        // Use midpoint of the coordinate array
        const midIdx = Math.floor(seg.coordinates.length / 2);
        [lng, lat] = seg.coordinates[midIdx];
      } else {
        // Midpoint between start and end
        lat = (seg.start[0] + seg.end[0]) / 2;
        lng = (seg.start[1] + seg.end[1]) / 2;
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat],
        },
        properties: {
          label: String(i + 1),
          name: seg.name,
        },
      };
    });

    const lineSource = map.getSource('route-builder') as mapboxgl.GeoJSONSource | undefined;
    if (lineSource) {
      lineSource.setData({
        type: 'FeatureCollection',
        features: lineFeatures,
      });
    }

    const pointSource = map.getSource('route-builder-points') as mapboxgl.GeoJSONSource | undefined;
    if (pointSource) {
      pointSource.setData({
        type: 'FeatureCollection',
        features: pointFeatures,
      });
    }
  }, [routeSegments]);

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

  // Update segment highlight when highlighted IDs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    // We use the curvature layer filter to create highlight — but since we don't have
    // direct access to segment geometries by ID via the tile source, we'll use the
    // waypoint coordinates to show highlighted segments via a separate approach.
    // For now, the waypoint markers + route line provide visual feedback.
    // Full segment highlighting would require querying rendered features.

    // Query rendered features for highlighted segments
    const features = map.queryRenderedFeatures({
      layers: ['curvature-layer'],
    });

    const highlightFeatures: GeoJSON.Feature[] = [];
    const matchIds = new Set(waypointHighlightedIds);

    for (const f of features) {
      const fId = String(f.properties?.id || f.properties?.way_id || '');
      if (matchIds.has(fId) && f.geometry.type === 'LineString') {
        highlightFeatures.push({
          type: 'Feature',
          geometry: f.geometry,
          properties: {},
        });
      }
    }

    const highlightSource = map.getSource('waypoint-highlight') as mapboxgl.GeoJSONSource | undefined;
    if (highlightSource) {
      highlightSource.setData({
        type: 'FeatureCollection',
        features: highlightFeatures,
      });
    }
  }, [waypointHighlightedIds, waypointRouteWaypoints]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
