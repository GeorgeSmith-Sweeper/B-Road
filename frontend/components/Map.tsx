'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useAppStore } from '@/store/useAppStore';
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

      sourceAddedRef.current = true;

      // Click handler for popups
      map.on('click', 'curvature-layer', (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        if (!props) return;

        const lengthMi = props.length ? (props.length / 1609).toFixed(2) : '?';
        const surface = props.paved ? 'paved' : 'unpaved';

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>${props.name || 'Unnamed Road'}</strong><br/>
              Curvature: ${props.curvature}<br/>
              Length: ${lengthMi} mi<br/>
              Surface: ${surface}
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
