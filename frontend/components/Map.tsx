'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useAppStore } from '@/store/useAppStore';
import { RoadFeature, Segment } from '@/types';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface MapProps {
  onSegmentClick?: (segment: Segment) => void;
}

export default function Map({ onSegmentClick }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { mapboxToken, currentData, mode, selectedSegments } = useAppStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-72.7, 44.0], // Vermont coordinates
      zoom: 8,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Add/update roads layer when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentData) return;

    const mapInstance = map.current;

    // Remove existing layers and sources
    if (mapInstance.getLayer('roads-layer')) {
      mapInstance.removeLayer('roads-layer');
    }
    if (mapInstance.getLayer('selected-segments-layer')) {
      mapInstance.removeLayer('selected-segments-layer');
    }
    if (mapInstance.getSource('roads')) {
      mapInstance.removeSource('roads');
    }
    if (mapInstance.getSource('selected-segments')) {
      mapInstance.removeSource('selected-segments');
    }

    // Add roads source
    mapInstance.addSource('roads', {
      type: 'geojson',
      data: currentData,
    });

    // Add roads layer with curvature-based coloring
    mapInstance.addLayer({
      id: 'roads-layer',
      type: 'line',
      source: 'roads',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': [
          'case',
          ['<', ['get', 'curvature'], 600],
          '#FFC107', // Yellow - mild curves
          ['<', ['get', 'curvature'], 1000],
          '#FF9800', // Orange - moderate curves
          ['<', ['get', 'curvature'], 2000],
          '#F44336', // Red - very curvy
          '#9C27B0', // Purple - extremely curvy
        ],
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });

    // Add click handler
    mapInstance.on('click', 'roads-layer', (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0] as unknown as RoadFeature;

      if (mode === 'stitch' && onSegmentClick) {
        // Convert feature to Segment for route building
        const segment: Segment = {
          id: feature.id?.toString() || '',
          way_id: feature.properties.way_id || '',
          start: feature.properties.start || [0, 0],
          end: feature.properties.end || [0, 0],
          length: feature.properties.length || 0,
          radius: feature.properties.radius || 0,
          curvature: feature.properties.curvature,
          curvature_level: feature.properties.curvature_level || '',
          name: feature.properties.name,
          highway: feature.properties.highway || '',
          surface: feature.properties.surface,
        };
        onSegmentClick(segment);
      } else {
        // Show popup with road details
        const props = feature.properties;
        const curvatureClass =
          props.curvature < 600
            ? 'bg-yellow-400 text-black'
            : props.curvature < 1000
            ? 'bg-orange-500 text-white'
            : 'bg-red-500 text-white';

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `
            <div class="p-2">
              <h3 class="font-bold text-lg mb-2">${props.name}</h3>
              <table class="text-sm">
                <tr>
                  <td class="font-semibold pr-2">Curvature:</td>
                  <td>
                    <span class="px-2 py-1 rounded ${curvatureClass}">
                      ${Math.round(props.curvature)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Length:</td>
                  <td>${props.length_mi.toFixed(2)} mi (${props.length_km.toFixed(2)} km)</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Surface:</td>
                  <td>${props.surface}</td>
                </tr>
              </table>
            </div>
          `
          )
          .addTo(mapInstance);
      }
    });

    // Change cursor on hover
    mapInstance.on('mouseenter', 'roads-layer', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });

    mapInstance.on('mouseleave', 'roads-layer', () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    // Fit bounds to show all roads
    if (currentData.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      currentData.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      });
      mapInstance.fitBounds(bounds, { padding: 50 });
    }
  }, [mapLoaded, currentData, mode, onSegmentClick]);

  // Update selected segments visualization
  useEffect(() => {
    if (!map.current || !mapLoaded || selectedSegments.length === 0) return;

    const mapInstance = map.current;

    // Create GeoJSON for selected route
    const coordinates: [number, number][] = [];
    selectedSegments.forEach((seg, idx) => {
      if (idx === 0) {
        coordinates.push([seg.start[1], seg.start[0]]);
      }
      coordinates.push([seg.end[1], seg.end[0]]);
    });

    const routeGeoJSON = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates,
          },
          properties: {},
        },
      ],
    };

    // Remove existing selected layer
    if (mapInstance.getLayer('selected-segments-layer')) {
      mapInstance.removeLayer('selected-segments-layer');
    }
    if (mapInstance.getSource('selected-segments')) {
      mapInstance.removeSource('selected-segments');
    }

    // Add selected route layer
    mapInstance.addSource('selected-segments', {
      type: 'geojson',
      data: routeGeoJSON,
    });

    mapInstance.addLayer({
      id: 'selected-segments-layer',
      type: 'line',
      source: 'selected-segments',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#00ff00',
        'line-width': 5,
        'line-opacity': 0.8,
      },
    });
  }, [mapLoaded, selectedSegments]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      {!mapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <p className="text-gray-600">Loading map configuration...</p>
        </div>
      )}
    </div>
  );
}
