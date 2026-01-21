'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const mapboxToken = useAppStore((state) => state.mapboxToken);
  const curvatureData = useAppStore((state) => state.curvatureData);
  const setCurvatureData = useAppStore((state) => state.setCurvatureData);
  const selectedSource = useAppStore((state) => state.selectedSource);
  const setCurvatureLoading = useAppStore((state) => state.setCurvatureLoading);
  const searchFilters = useAppStore((state) => state.searchFilters);

  // Fetch curvature data for the current viewport
  const fetchData = async (map: mapboxgl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    let minCurvature = searchFilters.min_curvature;
    let limit = 2000;

    if (zoom < 8) {
      minCurvature = Math.max(1000, minCurvature);
      limit = 500;
    } else if (zoom < 10) {
      minCurvature = Math.max(500, minCurvature);
      limit = 1000;
    }

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    try {
      setCurvatureLoading(true);
      const data = await apiClient.getCurvatureSegments(
        bbox,
        minCurvature,
        limit,
        selectedSource || undefined
      );
      setCurvatureData(data);
    } catch (error) {
      console.error('Error fetching curvature data:', error);
    } finally {
      setCurvatureLoading(false);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-72.7, 44.0],
      zoom: 8,
    });

    mapRef.current = map;

    map.on('load', () => {
      setIsLoaded(true);
      fetchData(map);
    });

    let debounceTimeout: NodeJS.Timeout;
    map.on('moveend', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => fetchData(map), 300);
    });

    return () => {
      clearTimeout(debounceTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // Update data layer when curvatureData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Update or add source
    const source = map.getSource('curvature') as mapboxgl.GeoJSONSource;
    if (source && curvatureData) {
      source.setData(curvatureData);
    } else if (curvatureData) {
      map.addSource('curvature', {
        type: 'geojson',
        data: curvatureData,
      });

      map.addLayer({
        id: 'curvature-layer',
        type: 'line',
        source: 'curvature',
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

      // Click handler for popups
      map.on('click', 'curvature-layer', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>${props?.name || 'Unnamed Road'}</strong><br/>
              Curvature: ${props?.curvature}<br/>
              Length: ${props?.length_mi?.toFixed(2)} mi<br/>
              Surface: ${props?.surface || 'unknown'}
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
    }
  }, [curvatureData, isLoaded]);

  // Refetch when filters change
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      fetchData(mapRef.current);
    }
  }, [selectedSource, searchFilters.min_curvature]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
