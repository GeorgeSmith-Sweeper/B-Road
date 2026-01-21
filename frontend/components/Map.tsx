'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { CancelTokenSource } from 'axios';
import { useAppStore } from '@/store/useAppStore';
import { apiClient, createCancelToken } from '@/lib/api';
import { ApiError } from '@/types';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const cancelTokenRef = useRef<CancelTokenSource | null>(null);
  const layerInitializedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const mapboxToken = useAppStore((state) => state.mapboxToken);
  const curvatureData = useAppStore((state) => state.curvatureData);
  const setCurvatureData = useAppStore((state) => state.setCurvatureData);
  const selectedSource = useAppStore((state) => state.selectedSource);
  const setCurvatureLoading = useAppStore((state) => state.setCurvatureLoading);
  const searchFilters = useAppStore((state) => state.searchFilters);
  const curvatureError = useAppStore((state) => state.curvatureError);
  const setCurvatureError = useAppStore((state) => state.setCurvatureError);

  // Fetch curvature data for the current viewport
  const fetchData = useCallback(async (map: mapboxgl.Map) => {
    const bounds = map.getBounds();
    if (!bounds) return;

    // Cancel any in-flight request
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel();
    }
    cancelTokenRef.current = createCancelToken();

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
      setCurvatureError(null);
      const data = await apiClient.getCurvatureSegments(
        bbox,
        minCurvature,
        limit,
        selectedSource || undefined,
        cancelTokenRef.current
      );
      setCurvatureData(data);
    } catch (error) {
      const apiError = error as ApiError;
      // Don't treat cancellation as an error
      if (apiError.type === 'cancelled') {
        return;
      }
      console.error('Error fetching curvature data:', apiError);
      setCurvatureError(apiError);
    } finally {
      setCurvatureLoading(false);
    }
  }, [searchFilters.min_curvature, selectedSource, setCurvatureData, setCurvatureLoading, setCurvatureError]);

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
    });

    let debounceTimeout: NodeJS.Timeout;
    const handleMoveEnd = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (mapRef.current) {
          fetchData(mapRef.current);
        }
      }, 300);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      clearTimeout(debounceTimeout);
      // Cancel any pending requests
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel();
      }
      map.off('moveend', handleMoveEnd);
      map.remove();
      mapRef.current = null;
      layerInitializedRef.current = false;
    };
  }, [mapboxToken, fetchData]);

  // Initial data fetch when map loads
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      fetchData(mapRef.current);
    }
  }, [isLoaded, fetchData]);

  // Initialize layer once and update data when curvatureData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Update existing source if it exists
    const source = map.getSource('curvature') as mapboxgl.GeoJSONSource | undefined;
    if (source && curvatureData) {
      source.setData(curvatureData);
      return;
    }

    // Only initialize layer once
    if (layerInitializedRef.current || !curvatureData) return;
    layerInitializedRef.current = true;

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

    // Click handler for popups - only added once
    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
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
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', 'curvature-layer', handleClick);
    map.on('mouseenter', 'curvature-layer', handleMouseEnter);
    map.on('mouseleave', 'curvature-layer', handleMouseLeave);
  }, [curvatureData, isLoaded]);

  // Refetch when filters change (but not on initial mount)
  const prevFiltersRef = useRef({ selectedSource, min_curvature: searchFilters.min_curvature });
  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current.selectedSource !== selectedSource ||
      prevFiltersRef.current.min_curvature !== searchFilters.min_curvature;

    prevFiltersRef.current = { selectedSource, min_curvature: searchFilters.min_curvature };

    if (mapRef.current && isLoaded && filtersChanged) {
      fetchData(mapRef.current);
    }
  }, [selectedSource, searchFilters.min_curvature, isLoaded, fetchData]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {curvatureError && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#FEE2E2',
            border: '1px solid #F87171',
            borderRadius: 8,
            padding: '12px 16px',
            maxWidth: 400,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
              Error loading roads
            </div>
            <div style={{ fontSize: 14, color: '#7F1D1D' }}>
              {curvatureError.message}
            </div>
          </div>
          {curvatureError.retryable && (
            <button
              onClick={() => mapRef.current && fetchData(mapRef.current)}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Retry
            </button>
          )}
          <button
            onClick={() => setCurvatureError(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#991B1B',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
